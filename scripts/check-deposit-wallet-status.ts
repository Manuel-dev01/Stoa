/**
 * check-deposit-wallet-status.ts
 *
 * Check the deposit wallet's on-chain status and whether it has been properly
 * registered/linked with Polymarket.
 */

import { createWalletClient, http, createPublicClient } from "viem"
import { polygon } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const DEPOSIT_WALLET = "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a"
const PUSD = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB"
const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

async function main() {
  const rawKey = process.env.AGENT_PRIVATE_KEY!
  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key as `0x${string}`)

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http("https://polygon-bor-rpc.publicnode.com"),
  })

  console.log("Agent EOA:", account.address)
  console.log("Deposit wallet:", DEPOSIT_WALLET)
  console.log()

  // Check if deposit wallet has code
  const code = await publicClient.getBytecode({ address: DEPOSIT_WALLET as `0x${string}` })
  console.log("Deposit wallet code length:", code ? code.length : 0)
  console.log("Has code:", !!code && code !== "0x")
  console.log("Code preview:", code ? code.slice(0, 42) + "..." : "none")
  console.log()

  // Check implementation slot (ERC-1967)
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  const impl = await publicClient.getStorageAt({
    address: DEPOSIT_WALLET as `0x${string}`,
    slot: implSlot as `0x${string}`,
  })
  console.log("ERC-1967 implementation slot:", impl)
  console.log()

  // Check pUSD balance
  const pusdBalance = await publicClient.readContract({
    address: PUSD as `0x${string}`,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [DEPOSIT_WALLET as `0x${string}`],
  })
  console.log("pUSD balance:", pusdBalance.toString(), "=", Number(pusdBalance) / 1e6, "pUSD")

  // Check USDC.e balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_E as `0x${string}`,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [DEPOSIT_WALLET as `0x${string}`],
  })
  console.log("USDC.e balance:", usdcBalance.toString(), "=", Number(usdcBalance) / 1e6, "USDC.e")
  console.log()

  // Check pUSD allowance for CTF Exchange V2
  const ctfExchangeV2 = "0xE111180000d2663C0091e4f400237545B87B996B"
  const allowance = await publicClient.readContract({
    address: PUSD as `0x${string}`,
    abi: [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "allowance",
    args: [DEPOSIT_WALLET as `0x${string}`, ctfExchangeV2 as `0x${string}`],
  })
  console.log("pUSD allowance for CTF Exchange V2:", allowance.toString())
  console.log("Is MAX_UINT256:", allowance.toString() === "115792089237316195423570985008687907853269984665640564039457584007913129639935")
  console.log()

  // Check CTF approval (setApprovalForAll)
  const ctf = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
  const isApproved = await publicClient.readContract({
    address: ctf as `0x${string}`,
    abi: [{ name: "isApprovedForAll", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }] }],
    functionName: "isApprovedForAll",
    args: [DEPOSIT_WALLET as `0x${string}`, ctfExchangeV2 as `0x${string}`],
  })
  console.log("CTF setApprovalForAll for CTF Exchange V2:", isApproved)

  // Check EOA's pUSD balance
  const eoaPusd = await publicClient.readContract({
    address: PUSD as `0x${string}`,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [account.address as `0x${string}`],
  })
  console.log("\nEOA pUSD balance:", eoaPusd.toString(), "=", Number(eoaPusd) / 1e6, "pUSD")

  // Check EOA's USDC.e balance
  const eoaUsdc = await publicClient.readContract({
    address: USDC_E as `0x${string}`,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [account.address as `0x${string}`],
  })
  console.log("EOA USDC.e balance:", eoaUsdc.toString(), "=", Number(eoaUsdc) / 1e6, "USDC.e")

  // Check relayer deployment status
  console.log("\n--- Relayer deployment check ---")
  const relayerApiKey = process.env.RELAYER_API_KEY!
  const relayerApiAddress = process.env.RELAYER_API_KEY_ADDRESS!

  const relayerResp = await fetch(
    `https://relayer-v2.polymarket.com/deployed?address=${account.address}&type=WALLET`,
    {
      headers: {
        "x-api-key": relayerApiKey,
        "x-api-key-address": relayerApiAddress,
      },
    }
  )
  console.log("Relayer /deployed (EOA):", relayerResp.status, await relayerResp.text())

  const relayerResp2 = await fetch(
    `https://relayer-v2.polymarket.com/deployed?address=${DEPOSIT_WALLET}&type=WALLET`,
    {
      headers: {
        "x-api-key": relayerApiKey,
        "x-api-key-address": relayerApiAddress,
      },
    }
  )
  console.log("Relayer /deployed (deposit wallet):", relayerResp2.status, await relayerResp2.text())
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
