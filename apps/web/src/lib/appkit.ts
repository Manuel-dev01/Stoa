/**
 * Circle App Kit integration for cross-chain USDC funding.
 *
 * Signs using the wallet the user connected through Dynamic, not the raw
 * `window.ethereum` injection. This is important because users sometimes
 * have multiple accounts in MetaMask (including imported agent keys), and
 * `window.ethereum` returns "whichever MetaMask happens to call its active
 * account" rather than the one our UI shows as connected.
 */

import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'

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
  // EIP-1193 provider sourced from the user's connected wallet (Dynamic primaryWallet).
  // Pass `undefined` to fall back to window.ethereum for backwards compatibility.
  provider?: unknown
}

/**
 * Bridge USDC from a source chain to Arc testnet via CCTP V2.
 */
export async function bridgeToArc(params: BridgeParams) {
  const provider =
    params.provider ??
    (typeof window !== 'undefined' ? (window as { ethereum?: unknown }).ethereum : undefined)

  if (!provider) {
    throw new Error('No browser wallet detected. Connect a wallet first.')
  }

  const adapter = await createViemAdapterFromProvider({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: provider as any,
  })

  const kit = new AppKit()

  try {
    const result = await kit.bridge({
      from: { adapter, chain: params.fromChain },
      to: { adapter, chain: APP_KIT_CHAINS.arcTestnet },
      amount: params.amount,
    })
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('x-user-agent') || msg.includes('CORS') || msg.includes('Failed to fetch')) {
      throw new Error('Bridge could not reach Circle API. This may be a network restriction. Try again from a standard internet connection.')
    }
    throw e
  }
}
