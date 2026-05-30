/**
 * Stoa Event Indexer
 *
 * Polls StoaRegistry and StoaTreasury on Arc testnet for new events
 * and writes them to Supabase. Runs as a long-running process.
 *
 * Usage: npx tsx scripts/indexer.ts
 *
 * Env vars required (from .env.local at repo root):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_ARC_RPC, NEXT_PUBLIC_STOA_REGISTRY_ADDRESS
 *   INDEXER_START_BLOCK, INDEXER_POLL_INTERVAL_MS
 * Optional:
 *   STOA_APP_URL (default https://stoa-agents.vercel.app) — where to POST
 *     newly-indexed trace hashes so the persona classifier runs.
 *   INDEXER_AUTH_TOKEN — bearer token if the classify endpoint is gated.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createPublicClient, http, type PublicClient, decodeEventLog, formatUnits } from 'viem'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'node:http';
// --- Config ---

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC || process.env.ARC_TESTNET_RPC
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_STOA_REGISTRY_ADDRESS as `0x${string}` | undefined
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_STOA_TREASURY_ADDRESS as `0x${string}` | undefined
const START_BLOCK = BigInt(process.env.INDEXER_START_BLOCK || '42766000')
const POLL_INTERVAL = Number(process.env.INDEXER_POLL_INTERVAL_MS || '5000')
const STOA_APP_URL = process.env.STOA_APP_URL || 'https://stoa-agents.vercel.app'
const INDEXER_AUTH_TOKEN = process.env.INDEXER_AUTH_TOKEN || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!ARC_RPC || !REGISTRY_ADDRESS) {
  console.error('Missing NEXT_PUBLIC_ARC_RPC or NEXT_PUBLIC_STOA_REGISTRY_ADDRESS')
  process.exit(1)
}

// --- ABIs (minimal, event-only) ---

const registryAbi = [
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agentId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TracePublished',
    inputs: [
      { name: 'agentId', type: 'bytes32', indexed: true },
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'traceHash', type: 'bytes32', indexed: false },
      { name: 'rating', type: 'int8', indexed: false },
      { name: 'confidenceBps', type: 'uint16', indexed: false },
      { name: 'irysReceipt', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

const treasuryAbi = [
  {
    type: 'event',
    name: 'Subscribed',
    inputs: [
      { name: 'agentId', type: 'bytes32', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Redeemed',
    inputs: [
      { name: 'agentId', type: 'bytes32', indexed: true },
      { name: 'shares', type: 'uint256', indexed: false },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

// --- Clients ---

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function createArcClient(): PublicClient {
  return createPublicClient({
    transport: http(ARC_RPC),
  }) as unknown as PublicClient
}

// --- State ---

let lastProcessedBlock = START_BLOCK

// --- Helpers ---

function bytes32ToHex(v: bigint | `0x${string}`): string {
  if (typeof v === 'string') return v
  return '0x' + v.toString(16).padStart(64, '0')
}

function timestampToDate(v: bigint): string {
  return new Date(Number(v) * 1000).toISOString()
}

// --- Upsert agent if not exists ---

async function ensureAgent(agentId: string, ownerAddress: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .upsert(
      { agent_id: agentId, owner_address: ownerAddress },
      { onConflict: 'agent_id', ignoreDuplicates: true }
    )
  if (error) {
    // Ignore duplicate key errors (agent already exists)
    if (!error.message.includes('duplicate key')) {
      console.error(`  [agents] upsert error: ${error.message}`)
    }
  }
}

// --- Insert trace ---

// Returns true only when this call actually inserted a new row. With
// ignoreDuplicates the upsert is ON CONFLICT DO NOTHING, so a chained
// .select() returns the row on insert and nothing on a skipped duplicate —
// that's the signal we use to decide whether to trigger classification.
async function insertTrace(params: {
  traceHash: string
  agentId: string
  marketId: string
  rating: number
  confidenceBps: number
  irysReceipt: string
  arcTxHash: string
  blockNumber: bigint
  publishedAt: string
}): Promise<boolean> {
  const venue = params.marketId.startsWith('0x6b616c7368693a') || params.marketId.toLowerCase().startsWith('kalshi:') ? 'kalshi' : 'polymarket'
  const { data, error } = await supabase.from('traces').upsert(
    {
      trace_hash: params.traceHash,
      agent_id: params.agentId,
      market_id: params.marketId,
      rating: params.rating,
      confidence_bps: params.confidenceBps,
      irys_receipt: params.irysReceipt,
      arc_tx_hash: params.arcTxHash,
      block_number: Number(params.blockNumber),
      published_at: params.publishedAt,
      venue,
    },
    { onConflict: 'trace_hash', ignoreDuplicates: true }
  ).select('trace_hash')
  if (error) {
    if (!error.message.includes('duplicate key')) {
      console.error(`  [traces] insert error: ${error.message}`)
    }
    return false
  }
  return Array.isArray(data) && data.length > 0
}

// Trigger server-side persona classification for a freshly-indexed trace.
// The classify endpoint is idempotent and runs the work in the background,
// so this is a quick fire-and-forget POST. Covers any publish path that
// bypasses /api/v1/traces (SDK direct-to-chain, etc.).
async function triggerClassification(traceHash: string): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (INDEXER_AUTH_TOKEN) headers['Authorization'] = `Bearer ${INDEXER_AUTH_TOKEN}`
    const resp = await fetch(`${STOA_APP_URL}/api/v1/internal/classify-trace`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ traceHash }),
      signal: AbortSignal.timeout(8000),
    })
    if (resp.status !== 202 && resp.status !== 200) {
      console.error(`  [classify] ${traceHash.slice(0, 12)}… returned ${resp.status}`)
    }
  } catch (err) {
    // Classification is additive; never let it interrupt indexing.
    console.error(`  [classify] ${traceHash.slice(0, 12)}… ${err instanceof Error ? err.message : String(err)}`)
  }
}

// --- Process blocks ---

async function processBlocks(client: PublicClient, fromBlock: bigint, toBlock: bigint): Promise<void> {
  // Fetch AgentRegistered events
  const agentLogs = await client.getLogs({
    address: REGISTRY_ADDRESS,
    event: registryAbi[0],
    fromBlock,
    toBlock,
  })

  for (const log of agentLogs) {
    const agentId = bytes32ToHex(log.args.agentId!)
    const owner = log.args.owner!
    console.log(`  AgentRegistered: ${agentId.slice(0, 18)}... → ${owner}`)
    await ensureAgent(agentId, owner)
  }

  // Fetch TracePublished events
  const traceLogs = await client.getLogs({
    address: REGISTRY_ADDRESS,
    event: registryAbi[1],
    fromBlock,
    toBlock,
  })

  for (const log of traceLogs) {
    const agentId = bytes32ToHex(log.args.agentId!)
    const marketId = bytes32ToHex(log.args.marketId!)
    const traceHash = bytes32ToHex(log.args.traceHash!)
    const rating = log.args.rating!
    const confidenceBps = log.args.confidenceBps!
    const irysReceipt = log.args.irysReceipt!
    const timestamp = log.args.timestamp!

    console.log(`  TracePublished: ${agentId.slice(0, 18)}... rating=${rating} conf=${confidenceBps}`)

    // Ensure agent exists (in case we missed the AgentRegistered event)
    await ensureAgent(agentId, '0x0000000000000000000000000000000000000000')

    const inserted = await insertTrace({
      traceHash,
      agentId,
      marketId,
      rating: Number(rating),
      confidenceBps: Number(confidenceBps),
      irysReceipt,
      arcTxHash: log.transactionHash,
      blockNumber: log.blockNumber,
      publishedAt: timestampToDate(timestamp),
    })

    // Only classify rows this indexer actually inserted. Traces that already
    // existed (daemon/REST publishes, or a prior indexer run) are skipped, so
    // catch-up after a restart never re-floods the classifier.
    if (inserted) {
      await triggerClassification(traceHash)
    }
  }

  // Fetch treasury events if treasury is configured
  if (TREASURY_ADDRESS && TREASURY_ADDRESS !== '0x0000000000000000000000000000000000000000') {
    const subscribedLogs = await client.getLogs({
      address: TREASURY_ADDRESS,
      event: treasuryAbi[0],
      fromBlock,
      toBlock,
    })

    for (const log of subscribedLogs) {
      const agentId = bytes32ToHex(log.args.agentId!)
      const assets = log.args.assets!
      console.log(`  Subscribed: ${agentId.slice(0, 18)}... assets=${formatUnits(assets, 6)} USDC`)
    }

    const redeemedLogs = await client.getLogs({
      address: TREASURY_ADDRESS,
      event: treasuryAbi[1],
      fromBlock,
      toBlock,
    })

    for (const log of redeemedLogs) {
      const agentId = bytes32ToHex(log.args.agentId!)
      const assets = log.args.assets!
      console.log(`  Redeemed: ${agentId.slice(0, 18)}... assets=${formatUnits(assets, 6)} USDC`)
    }
  }
}

// --- Main loop ---

async function main() {
  console.log('Stoa Indexer starting...')
  console.log(`  Registry: ${REGISTRY_ADDRESS}`)
  console.log(`  Treasury: ${TREASURY_ADDRESS || 'not configured'}`)
  console.log(`  Start block: ${START_BLOCK}`)
  console.log(`  Poll interval: ${POLL_INTERVAL}ms`)
  console.log('')

  const client = createArcClient()

  // Sync to latest on startup
  const latestBlock = await client.getBlockNumber()
  console.log(`Catching up from block ${lastProcessedBlock} to ${latestBlock}...`)

  const CHUNK = 10_000n
  let from = lastProcessedBlock
  while (from <= latestBlock) {
    const to = from + CHUNK > latestBlock ? latestBlock : from + CHUNK
    console.log(`Processing blocks ${from} → ${to}`)
    await processBlocks(client, from, to)
    from = to + 1n
  }
  lastProcessedBlock = latestBlock + 1n
  console.log(`Caught up to block ${latestBlock}`)
  console.log('')

  // Poll loop
  console.log('Polling for new events...')
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))

    try {
      const currentBlock = await client.getBlockNumber()
      if (currentBlock < lastProcessedBlock) continue

      console.log(`Polling blocks ${lastProcessedBlock} → ${currentBlock}`)
      await processBlocks(client, lastProcessedBlock, currentBlock)
      lastProcessedBlock = currentBlock + 1n
    } catch (err) {
      console.error('Poll error:', err)
    }
  }
}

// Dummy server to pass Koyeb health checks
const port = process.env.PORT || 8000;
createServer((req, res) => {
  res.writeHead(200);
  res.end('Indexer is running');
}).listen(port, () => {
  console.log(`Dummy health check server listening on port ${port}`);
});

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
