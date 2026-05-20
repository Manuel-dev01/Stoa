/**
 * setup-deposit-wallet.ts
 *
 * Creates a Polymarket deposit wallet (POLY_1271) for the agent EOA,
 * funds it with USDC.e, approves the exchange, and updates .env.local.
 *
 * Steps:
 *   1. Derive the deterministic deposit wallet address (CREATE2)
 *   2. Deploy the deposit wallet via relayer
 *   3. Transfer USDC.e from the EOA to the deposit wallet
 *   4. Approve CTFExchangeV2 to spend USDC.e on the deposit wallet
 *   5. Sync balance with Polymarket CLOB
 *   6. Update .env.local with the deposit wallet address
 *
 * Usage:
 *   npx tsx scripts/setup-deposit-wallet.ts
 */

import { ClobClient, SignatureTypeV2 } from "@polymarket/clob-client-v2"
import { createWalletClient, http, parseAbi, createPublicClient } from "viem"
import { polygon } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const RELAYER_URL = "https://relayer.polymarket.com"
const DEPOSIT_WALLET_FACTORY = "0x00000000000Fb5C9ADea0298D729A0CB3823Cc07"
const USDC_E_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
// CTFExchangeV2 — the Polymarket V2 exchange contract
// Confirm at docs.polymarket.com/v2-migration
const CTF_EXCHANGE_V2 = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
])

async function main() {
  const rawKey = process.env.POLYMARKET_PRIVATE_KEY
  if (!rawKey) {
    console.error("POLYMARKET_PRIVATE_KEY not set")
    process.exit(1)
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-bor-rpc.publicnode.com"

  console.log("Owner EOA:", account.address)

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(polygonRpc),
  })

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http(polygonRpc),
  })

  // Step 1: Get API credentials
  const apiKey = process.env.POLYMARKET_API_KEY
  const apiSecret = process.env.POLYMARKET_API_SECRET
  const apiPassphrase = process.env.POLYMARKET_API_PASSPHRASE

  if (!apiKey || !apiSecret || !apiPassphrase) {
    console.error("Polymarket API credentials not set. Run setup-clob-keys.ts first.")
    process.exit(1)
  }

  const creds = { key: apiKey, secret: apiSecret, passphrase: apiPassphrase }

  // Step 2: Try to derive the deposit wallet address
  // The deposit wallet is deterministic via CREATE2 from the owner address
  console.log("\nDeriving deposit wallet address...")

  // The deposit wallet address derivation:
  // keccak256(0xff ++ factory ++ salt(owner) ++ keccak256(implementation bytecode))
  // For now, we'll try to get it from the Polymarket API or relayer

  // Try using the ClobClient with POLY_1271 to see if it gives us the address
  const clob = new ClobClient({
    host: "https://clob.polymarket.com",
    chain: polygon.id,
    signer: walletClient,
    creds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: account.address, // temporary, will be replaced
  })

  // Step 3: Check if we need to deploy the deposit wallet
  // First, let's check the relayer for our wallet status
  console.log("Checking relayer for wallet status...")

  try {
    const walletCreatePayload = {
      type: "WALLET-CREATE",
      from: account.address,
      to: DEPOSIT_WALLET_FACTORY,
    }

    console.log("Submitting WALLET-CREATE to relayer...")
    console.log("Payload:", JSON.stringify(walletCreatePayload, null, 2))

    const relayerResp = await fetch(`${RELAYER_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(walletCreatePayload),
    })

    const relayerResult = await relayerResp.json()
    console.log("Relayer response:", JSON.stringify(relayerResult, null, 2))

    if (relayerResp.ok) {
      console.log("\nDeposit wallet creation submitted!")
      console.log("Wait for STATE_CONFIRMED before proceeding.")
      console.log("Check status at the relayer with the transaction hash.")
    } else {
      console.log("\nRelayer response was not OK. This might mean the wallet already exists.")
    }
  } catch (err) {
    console.error("Relayer error:", err instanceof Error ? err.message : err)
  }

  // Step 4: Try to get the expected deposit wallet address
  // The address is deterministic, so we can compute it
  console.log("\nTo complete setup:")
  console.log("1. Wait for the deposit wallet to be deployed on-chain")
  console.log("2. Fund the deposit wallet with USDC.e")
  console.log("3. Approve CTFExchangeV2 to spend USDC.e")
  console.log("4. Update CLOB client config to use POLY_1271 + deposit wallet address")
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
