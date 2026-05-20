import { defineChain } from "viem"
import { http, createConfig } from "wagmi"
import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets"

export const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["/api/rpc"] },
  },
  testnet: true,
})

let _config: ReturnType<typeof createConfig> | null = null

export function getConfig() {
  if (_config) return _config

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder"

  const connectors = connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [injectedWallet, metaMaskWallet, walletConnectWallet],
      },
    ],
    { appName: "Stoa", projectId }
  )

  _config = createConfig({
    chains: [arcTestnet],
    connectors,
    transports: {
      [arcTestnet.id]: http("/api/rpc"),
    },
  })

  return _config
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
