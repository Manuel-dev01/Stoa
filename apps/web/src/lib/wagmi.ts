import { defineChain } from "viem"
import { http, createConfig } from "wagmi"
import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets"

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC
if (!ARC_RPC) {
  throw new Error(
    "NEXT_PUBLIC_ARC_RPC is not set. Add it to .env.local or Vercel environment variables."
  )
}

console.log("Arc RPC:", ARC_RPC.replace(/\/v2\/.+/, "/v2/***"))

export const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [ARC_RPC] },
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
      [arcTestnet.id]: http(ARC_RPC),
    },
  })

  return _config
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
