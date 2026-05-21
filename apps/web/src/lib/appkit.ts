/**
 * Circle App Kit integration for cross-chain USDC funding.
 *
 * Provides bridge (CCTP V2), send, and unified balance capabilities.
 * Uses the viem adapter for wallet interaction.
 */

import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2'

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

interface SendParams {
  to: string
  amount: string
}

/**
 * Create an App Kit instance with a viem adapter for the given private key.
 */
function createKitWithKey(privateKey: string) {
  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`

  const adapter = createViemAdapterFromPrivateKey({
    privateKey: key as `0x${string}`,
  })

  const kit = new AppKit()
  return { kit, adapter }
}

/**
 * Bridge USDC from a source chain to Arc testnet via CCTP V2.
 */
export async function bridgeToArc(params: BridgeParams, privateKey: string) {
  const { kit, adapter } = createKitWithKey(privateKey)

  const result = await kit.bridge({
    from: { adapter, chain: params.fromChain },
    to: { adapter, chain: APP_KIT_CHAINS.arcTestnet },
    amount: params.amount,
  })

  return result
}

/**
 * Send USDC on Arc testnet to a recipient.
 */
export async function sendOnArc(params: SendParams, privateKey: string) {
  const { kit, adapter } = createKitWithKey(privateKey)

  const result = await kit.send({
    from: { adapter, chain: APP_KIT_CHAINS.arcTestnet },
    to: params.to,
    amount: params.amount,
    token: 'USDC',
  })

  return result
}
