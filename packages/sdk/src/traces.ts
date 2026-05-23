import { createPublicClient, createWalletClient, http, type Hex, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { STOA_REGISTRY } from '@stoa/shared'
import type { StoaConfig, PublishTraceParams } from './types.js'

const ARC_CHAIN = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [''] } },
} as const

const REGISTRY_ABI = [
  {
    name: 'publishTrace',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'bytes32' },
      { name: 'marketId', type: 'bytes32' },
      { name: 'traceHash', type: 'bytes32' },
      { name: 'rating', type: 'int8' },
      { name: 'confidenceBps', type: 'uint16' },
      { name: 'irysReceipt', type: 'string' },
    ],
    outputs: [],
  },
] as const

function getWalletClient(config: StoaConfig) {
  const key = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
  const account = privateKeyToAccount(key as Hex)
  return createWalletClient({
    account,
    chain: ARC_CHAIN,
    transport: http(config.arcRpc),
  })
}

export async function publishTrace(
  config: StoaConfig,
  params: PublishTraceParams,
): Promise<string> {
  const walletClient = getWalletClient(config)

  // Derive trace hash from the trace content
  const traceHash = await hashTrace(params.trace)

  const hash = await walletClient.writeContract({
    address: STOA_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'publishTrace',
    args: [
      params.agentId as Hex,
      params.marketId as Hex,
      traceHash as Hex,
      params.trace.decision.rating,
      params.trace.decision.confidenceBps,
      params.irysReceipt,
    ],
  })

  return hash
}

/**
 * Hash a trace using Keccak256 (matching the Python agent's hash algorithm).
 * Canonicalizes JSON with sorted keys before hashing.
 */
export async function hashTrace(trace: Record<string, unknown>): Promise<string> {
  const encoded = JSON.stringify(trace, Object.keys(trace).sort())
  return keccak256(toHex(encoded))
}
