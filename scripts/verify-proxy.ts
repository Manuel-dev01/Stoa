import { createPublicClient, http, parseAbiItem } from "viem"

const RPC_URL = "https://stoa-agents.vercel.app/api/rpc"
const STOA_REGISTRY = "0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b"
const STOA_REGISTRY_DEPLOY_BLOCK = 42766000n
const CHUNK_SIZE = 10_000n

const client = createPublicClient({ transport: http(RPC_URL) })

const tracePublishedEvent = parseAbiItem(
  "event TracePublished(bytes32 indexed agentId, bytes32 indexed marketId, bytes32 traceHash, int8 rating, uint16 confidenceBps, string irysReceipt, uint256 timestamp)"
)

async function main() {
  console.log("Testing getLogs through proxy:", RPC_URL)
  console.log("Registry:", STOA_REGISTRY)

  const latestBlock = await client.getBlockNumber()
  console.log("Latest block:", latestBlock.toString())

  let totalLogs = 0
  let from = STOA_REGISTRY_DEPLOY_BLOCK

  while (from <= latestBlock) {
    const to = from + CHUNK_SIZE > latestBlock ? latestBlock : from + CHUNK_SIZE
    const logs = await client.getLogs({
      address: STOA_REGISTRY as `0x${string}`,
      event: tracePublishedEvent,
      fromBlock: from,
      toBlock: to,
    })
    if (logs.length > 0) {
      console.log(`  Blocks ${from}-${to}: ${logs.length} TracePublished events`)
    }
    totalLogs += logs.length
    from = to + 1n
  }

  console.log(`\nTotal TracePublished events: ${totalLogs}`)
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})
