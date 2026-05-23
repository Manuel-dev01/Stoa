import { defineChain } from "viem"
import { http, createConfig } from "wagmi"

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

  _config = createConfig({
    chains: [arcTestnet],
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
