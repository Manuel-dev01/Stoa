import { createPublicClient, http, parseAbiItem } from "viem"

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC
if (!ARC_RPC) {
  console.error("NEXT_PUBLIC_ARC_RPC not set")
  process.exit(1)
}

const STOA_REGISTRY = process.env.NEXT_PUBLIC_STOA_REGISTRY_ADDRESS
if (!STOA_REGISTRY) {
  console.error("NEXT_PUBLIC_STOA_REGISTRY_ADDRESS not set")
  process.exit(1)
}

const STOA_REGISTRY_DEPLOY_BLOCK = 42766000n
const CHUNK_SIZE = 10_000n

const client = createPublicClient({
  transport: http(ARC_RPC),
})

const tracePublishedEvent = parseAbiItem(
  "event TracePublished(bytes32 indexed agentId, bytes32 indexed marketId, bytes32 traceHash, int8 rating, uint16 confidenceBps, string irysReceipt, uint256 timestamp)"
)

async function main() {
  console.log("Arc RPC:", ARC_RPC!.replace(/\/v2\/.+/, "/v2/***"))
  console.log("Registry:", STOA_REGISTRY)
  console.log("From block:", STOA_REGISTRY_DEPLOY_BLOCK.toString())

  const latestBlock = await client.getBlockNumber()
  console.log("Latest block:", latestBlock.toString())
  console.log("Block range:", (latestBlock - STOA_REGISTRY_DEPLOY_BLOCK).toString())

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
    console.log(`  Blocks ${from}-${to}: ${logs.length} TracePublished events`)
    totalLogs += logs.length
    from = to + 1n
  }

  console.log(`\nTotal TracePublished events: ${totalLogs}`)
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})
