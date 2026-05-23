import { EthereumWalletConnectors } from "@dynamic-labs/ethereum"

export const dynamicSettings = {
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "",
  walletConnectors: [EthereumWalletConnectors],
}

export const dynamicTheme = "dark" as const
