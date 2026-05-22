/**
 * Circle App Kit integration for cross-chain USDC funding.
 *
 * Bridge and send use the connected browser wallet (MetaMask).
 * The adapter is created from the EIP1193 provider, not a private key.
 */

import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'

const BRIDGE_TIMEOUT_MS = 30_000

export class BridgeTimeoutError extends Error {
  constructor() {
    super('Bridge request timed out after 30 seconds')
    this.name = 'BridgeTimeoutError'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new BridgeTimeoutError()), ms)
    ),
  ])
}

// Chain identifiers for App Kit (must match BridgeChain enum exactly)
export const APP_KIT_CHAINS = {
  arcTestnet: 'Arc_Testnet',
  polygon: 'Polygon',
  base: 'Base',
  arbitrum: 'Arbitrum',
  ethereum: 'Ethereum',
  polygonAmoy: 'Polygon_Amoy_Testnet',
  baseSepolia: 'Base_Sepolia',
  arbitrumSepolia: 'Arbitrum_Sepolia',
  ethereumSepolia: 'Ethereum_Sepolia',
} as const

export type AppKitChain = (typeof APP_KIT_CHAINS)[keyof typeof APP_KIT_CHAINS]

interface BridgeParams {
  fromChain: AppKitChain
  amount: string
}

/**
 * Bridge USDC from a source chain to Arc testnet via CCTP V2.
 * Uses the connected browser wallet (MetaMask) for signing.
 */
export async function bridgeToArc(params: BridgeParams) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No browser wallet detected. Connect MetaMask first.')
  }

  const adapter = await createViemAdapterFromProvider({
    provider: window.ethereum as any,
  })

  const kit = new AppKit()

  const result = await withTimeout(
    kit.bridge({
      from: { adapter, chain: params.fromChain },
      to: { adapter, chain: APP_KIT_CHAINS.arcTestnet },
      amount: params.amount,
    }),
    BRIDGE_TIMEOUT_MS,
  )

  return result
}
