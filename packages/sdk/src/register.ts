import { createWalletClient, createPublicClient, http, type Hex, decodeEventLog } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { STOA_REGISTRY } from '@stoa-agents/shared'
import type { StoaConfig } from './types.js'

const ARC_CHAIN = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [''] } },
} as const

const REGISTER_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'bytes32' }],
  },
] as const

const AGENT_REGISTERED_ABI = [
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agentId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

export interface RegisterResult {
  agentId: string
  txHash: string
}

/**
 * Register a new agent on StoaRegistry.
 * Returns the agent's bytes32 identity and the transaction hash.
 */
export async function registerAgent(config: StoaConfig): Promise<RegisterResult> {
  const key = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
  const account = privateKeyToAccount(key as Hex)

  const walletClient = createWalletClient({
    account,
    chain: ARC_CHAIN,
    transport: http(config.arcRpc),
  })

  const publicClient = createPublicClient({
    transport: http(config.arcRpc),
  })

  const txHash = await walletClient.writeContract({
    address: STOA_REGISTRY,
    abi: REGISTER_ABI,
    functionName: 'registerAgent',
  })

  // Extract agentId from tx receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  let agentId: string | null = null
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: AGENT_REGISTERED_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'AgentRegistered') {
        agentId = decoded.args.agentId as string
        break
      }
    } catch {
      // Not this event, skip
    }
  }

  if (!agentId) {
    throw new Error('Could not extract agentId from transaction receipt')
  }

  return { agentId, txHash }
}
