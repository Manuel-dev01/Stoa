import { type PublicClient } from "viem"
import { stoaRegistryAbi } from "@/lib/shared/stoaRegistry"
import { STOA_REGISTRY } from "@/lib/shared/addresses"

export interface TracePublishedEvent {
  agentId: `0x${string}`
  marketId: `0x${string}`
  traceHash: `0x${string}`
  rating: number
  confidenceBps: number
  irysReceipt: string
  timestamp: bigint
  blockNumber: bigint
  transactionHash: `0x${string}`
}

const STOA_REGISTRY_DEPLOY_BLOCK = 42930000n

export async function getAllTraces(client: PublicClient): Promise<TracePublishedEvent[]> {
  const logs = await client.getLogs({
    address: STOA_REGISTRY,
    event: {
      type: "event",
      name: "TracePublished",
      inputs: [
        { name: "agentId", type: "bytes32", indexed: true },
        { name: "marketId", type: "bytes32", indexed: true },
        { name: "traceHash", type: "bytes32", indexed: false },
        { name: "rating", type: "int8", indexed: false },
        { name: "confidenceBps", type: "uint16", indexed: false },
        { name: "irysReceipt", type: "string", indexed: false },
        { name: "timestamp", type: "uint256", indexed: false },
      ],
    },
    fromBlock: STOA_REGISTRY_DEPLOY_BLOCK,
    toBlock: "latest",
  })

  return logs.map((log) => ({
    agentId: log.args.agentId!,
    marketId: log.args.marketId!,
    traceHash: log.args.traceHash!,
    rating: log.args.rating!,
    confidenceBps: log.args.confidenceBps!,
    irysReceipt: log.args.irysReceipt!,
    timestamp: log.args.timestamp!,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
  }))
}

export async function getAgent(
  client: PublicClient,
  agentId: `0x${string}`
): Promise<{ owner: `0x${string}` }> {
  const owner = await client.readContract({
    address: STOA_REGISTRY,
    abi: stoaRegistryAbi,
    functionName: "agentOwner",
    args: [agentId],
  })
  return { owner }
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 10)}...${addr.slice(-4)}`
}

export function formatTimestamp(ts: bigint): string {
  const now = Date.now() / 1000
  const diff = now - Number(ts)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
