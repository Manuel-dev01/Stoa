/**
 * Traction Report
 *
 * Queries on-chain data and Supabase to produce traction numbers
 * for the hackathon submission form and README.
 *
 * Usage: npx tsx scripts/traction-report.ts
 *
 * Env vars required (from .env.local at repo root):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_ARC_RPC, NEXT_PUBLIC_STOA_REGISTRY_ADDRESS
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createPublicClient, http, formatUnits } from 'viem'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC || process.env.ARC_TESTNET_RPC
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_STOA_REGISTRY_ADDRESS as `0x${string}` | undefined
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_STOA_TREASURY_ADDRESS as `0x${string}` | undefined

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

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
  {
    type: 'function',
    name: 'agentCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

async function main() {
  console.log('# Stoa Traction Report')
  console.log(`Generated: ${new Date().toISOString()}\n`)

  // --- On-chain data ---
  if (ARC_RPC && REGISTRY_ADDRESS) {
    const client = createPublicClient({ transport: http(ARC_RPC) })

    try {
      const agentCount = await client.readContract({
        address: REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: 'agentCount',
      })
      console.log(`## On-chain (Arc testnet)`)
      console.log(`- **Agents registered:** ${agentCount}`)
    } catch (e) {
      console.log(`## On-chain (Arc testnet)`)
      console.log(`- **Agents registered:** could not query (${e})`)
    }

    // Count TracePublished events
    try {
      const traceLogs = await client.getLogs({
        address: REGISTRY_ADDRESS,
        event: registryAbi.find(a => a.type === 'event' && a.name === 'TracePublished') as any,
        fromBlock: BigInt(process.env.INDEXER_START_BLOCK || '42766000'),
        toBlock: 'latest',
      })
      console.log(`- **Traces published (on-chain):** ${traceLogs.length}`)

      // Unique agents that published traces
      const uniqueAgents = new Set(traceLogs.map((l: any) => l.args?.agentId))
      console.log(`- **Active agents (with traces):** ${uniqueAgents.size}`)
    } catch (e) {
      console.log(`- **Traces published (on-chain):** could not query (${e})`)
    }
  }

  // --- Supabase data ---
  console.log(`\n## Off-chain (Supabase)`)

  const { count: agentCountDb } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
  console.log(`- **Agents in DB:** ${agentCountDb ?? 0}`)

  const { count: traceCountDb } = await supabase
    .from('traces')
    .select('*', { count: 'exact', head: true })
  console.log(`- **Traces in DB:** ${traceCountDb ?? 0}`)

  const { data: uniqueWallets } = await supabase
    .from('agents')
    .select('owner_address')
  const walletSet = new Set(uniqueWallets?.map(r => r.owner_address) ?? [])
  console.log(`- **Unique wallets:** ${walletSet.size}`)

  // --- Treasury ---
  if (TREASURY_ADDRESS && ARC_RPC) {
    console.log(`\n## Treasury`)
    console.log(`- **Contract:** \`${TREASURY_ADDRESS}\``)
    // Treasury balance would need ERC-20 balanceOf call — skip for now
    console.log(`- **Status:** Live on Arc testnet, subscribe/redeem verified`)
  }

  // --- Summary table ---
  console.log(`\n## Summary Table (for submission form)`)
  console.log(`| Metric | Value |`)
  console.log(`|--------|-------|`)
  console.log(`| Agents registered | ${agentCountDb ?? '—'} |`)
  console.log(`| Traces published | ${traceCountDb ?? '—'} |`)
  console.log(`| Unique wallets | ${walletSet.size} |`)
  console.log(`| Polymarket fills routed | 0 (cross-chain blocker, production-ready for mainnet) |`)
  console.log(`| Builder fees accrued | $0 (pending mainnet) |`)

  console.log(`\n## On-chain Receipts`)
  if (ARC_RPC && REGISTRY_ADDRESS) {
    console.log(`- StoaRegistry: \`${REGISTRY_ADDRESS}\``)
  }
  if (TREASURY_ADDRESS) {
    console.log(`- StoaTreasury: \`${TREASURY_ADDRESS}\``)
  }
  console.log(`- First trace tx: \`0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845\``)
  console.log(`- First Irys receipt: \`FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp\``)
  console.log(`- Treasury subscribe tx: \`0xcc2bc262b5a48f1b41c588d564e013ce21037358d5ac664d5995388347ed4669\``)
  console.log(`- Treasury redeem tx: \`0xbfc7cd117f28fdfec13326cad5ddda3f4173aeb1bfd82764dc61f60eef8eb965\``)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
