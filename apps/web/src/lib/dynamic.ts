import { EthereumWalletConnectors } from "@dynamic-labs/ethereum"
import { mergeNetworks } from "@dynamic-labs/sdk-react-core"

const ARC_RPC =
  process.env.NEXT_PUBLIC_ARC_RPC ?? "https://rpc.testnet.arc.network"

const arcTestnet = {
  blockExplorerUrls: ["https://testnet.arcscan.app"],
  chainId: 5042002,
  chainName: "Arc Testnet",
  iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
  name: "Arc",
  nativeCurrency: {
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  networkId: 5042002,
  rpcUrls: [ARC_RPC],
  vanityName: "Arc Testnet",
}

// DynamicContextProvider throws if environmentId is empty, which fails the
// static prerender of any page mounting the provider when the env var is absent
// (e.g. Preview builds). Fall back to a syntactically-valid placeholder UUID so
// the provider mounts; it just won't authenticate. Production sets the real id.
const PLACEHOLDER_DYNAMIC_ENV_ID = "00000000-0000-0000-0000-000000000000"

export const dynamicSettings = {
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || PLACEHOLDER_DYNAMIC_ENV_ID,
  walletConnectors: [EthereumWalletConnectors],
  overrides: {
    evmNetworks: (networks: Parameters<typeof mergeNetworks>[1]) =>
      mergeNetworks([arcTestnet as Parameters<typeof mergeNetworks>[0][number]], networks),
  },
}

export const dynamicTheme = "dark" as const
