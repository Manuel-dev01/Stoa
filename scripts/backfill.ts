/**
 * Stoa Backfill Script
 *
 * One-shot indexer that processes historical events from a block range
 * and writes them to Supabase. Useful for catching up after downtime.
 *
 * Usage: npx tsx scripts/backfill.ts [--from-block N] [--to-block latest]
 *
 * Env vars required (from .env.local at repo root):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_ARC_RPC, NEXT_PUBLIC_STOA_REGISTRY_ADDRESS
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createPublicClient, http, type PublicClient } from 'viem'
import { createClient } from '@supabase/supabase-js'

// --- Config ---

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC || process.env.ARC_TESTNET_RPC
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_STOA_REGISTRY_ADDRESS as `0x${string}` | undefined
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_STOA_TREASURY_ADDRESS as `0x${string}` | undefined
const DEPLOY_BLOCK = BigInt(process.env.INDEXER_START_BLOCK || '42766000')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!ARC_RPC || !REGISTRY_ADDRESS) {
  console.error('Missing NEXT_PUBLIC_ARC_RPC or NEXT_PUBLIC_STOA_REGISTRY_ADDRESS')
  process.exit(1)
}

// --- Parse args ---

const args = process.argv.slice(2)
let fromBlock = DEPLOY_BLOCK
let toBlock: bigint | 'latest' = 'latest'

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from-block' && args[i + 1]) {
    fromBlock = BigInt(args[i + 1])
    i++
  }
  if (args[i] === '--to-block' && args[i + 1]) {
    toBlock = args[i + 1] === 'latest' ? 'latest' : BigInt(args[i + 1])
    i++
  }
}

// --- ABIs ---

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

// --- Clients ---

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function createArcClient(): PublicClient {
  return createPublicClient({
    transport: http(ARC_RPC),
  }) as unknown as PublicClient
}

// --- Helpers ---

function bytes32ToHex(v: bigint | `0x${string}`): string {
  if (typeof v === 'string') return v
  return '0x' + v.toString(16).padStart(64, '0')
}

function timestampToDate(v: bigint): string {
  return new Date(Number(v) * 1000).toISOString()
}

async function ensureAgent(agentId: string, ownerAddress: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .upsert(
      { agent_id: agentId, owner_address: ownerAddress },
      { onConflict: 'agent_id', ignoreDuplicates: true }
    )
  if (error && !error.message.includes('duplicate key')) {
    console.error(`  [agents] upsert error: ${error.message}`)
  }
}

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
}): Promise<void> {
  const { error } = await supabase.from('traces').upsert(
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
    },
    { onConflict: 'trace_hash', ignoreDuplicates: true }
  )
  if (error && !error.message.includes('duplicate key')) {
    console.error(`  [traces] insert error: ${error.message}`)
  }
}

// --- Main ---

async function main() {
  const client = createArcClient()

  const endBlock = toBlock === 'latest' ? await client.getBlockNumber() : toBlock

  console.log('Stoa Backfill')
  console.log(`  Registry: ${REGISTRY_ADDRESS}`)
  console.log(`  Range: ${fromBlock} → ${endBlock}`)
  console.log('')

  const CHUNK = 10_000n
  let agentCount = 0
  let traceCount = 0

  let from = fromBlock
  while (from <= endBlock) {
    const to = from + CHUNK > endBlock ? endBlock : from + CHUNK
    console.log(`Processing blocks ${from} → ${to}`)

    // AgentRegistered
    const agentLogs = await client.getLogs({
      address: REGISTRY_ADDRESS,
      event: registryAbi[0],
      fromBlock: from,
      toBlock: to,
    })
    for (const log of agentLogs) {
      const agentId = bytes32ToHex(log.args.agentId!)
      const owner = log.args.owner!
      await ensureAgent(agentId, owner)
      agentCount++
    }

    // TracePublished
    const traceLogs = await client.getLogs({
      address: REGISTRY_ADDRESS,
      event: registryAbi[1],
      fromBlock: from,
      toBlock: to,
    })
    for (const log of traceLogs) {
      const agentId = bytes32ToHex(log.args.agentId!)
      const marketId = bytes32ToHex(log.args.marketId!)
      const traceHash = bytes32ToHex(log.args.traceHash!)

      await ensureAgent(agentId, '0x0000000000000000000000000000000000000000')
      await insertTrace({
        traceHash,
        agentId,
        marketId,
        rating: Number(log.args.rating!),
        confidenceBps: Number(log.args.confidenceBps!),
        irysReceipt: log.args.irysReceipt!,
        arcTxHash: log.transactionHash,
        blockNumber: log.blockNumber,
        publishedAt: timestampToDate(log.args.timestamp!),
      })
      traceCount++
    }

    from = to + 1n
  }

  console.log('')
  console.log(`Done. Indexed ${agentCount} agents, ${traceCount} traces.`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
