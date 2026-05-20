/**
 * verify-routing.ts
 *
 * Constructs a signed Polymarket V2 order in dry-run mode and asserts
 * the builder field is set to our agent's bytes32 identifier.
 * Does NOT broadcast any order. Does NOT spend money.
 *
 * Usage:
 *   npx tsx scripts/verify-routing.ts
 */

import { ClobClient } from "@polymarket/clob-client-v2"
import { Chain } from "@polymarket/clob-client-v2"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

async function main() {
  const rawKey = process.env.POLYMARKET_PRIVATE_KEY
  if (!rawKey) {
    console.error("POLYMARKET_PRIVATE_KEY not set in .env.local")
    process.exit(1)
  }

  const apiKey = process.env.POLYMARKET_API_KEY
  const apiSecret = process.env.POLYMARKET_API_SECRET
  const apiPassphrase = process.env.POLYMARKET_API_PASSPHRASE
  const builderAddress = process.env.POLYMARKET_BUILDER_CODE

  if (!apiKey || !apiSecret || !apiPassphrase) {
    console.error("POLYMARKET_API_KEY, POLYMARKET_API_SECRET, POLYMARKET_API_PASSPHRASE must be set")
    process.exit(1)
  }

  if (!builderAddress) {
    console.error("POLYMARKET_BUILDER_CODE not set — register at polymarket.com/settings first")
    process.exit(1)
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-rpc.com"

  console.log("=== Polymarket V2 Routing Verification ===\n")
  console.log("Account:", account.address)
  console.log("Builder code:", builderAddress)
  console.log("Polygon RPC:", polygonRpc.replace(/\/v2\/.+/, "/v2/***"))
  console.log()

  const signer = createWalletClient({ account, transport: http(polygonRpc) })

  const creds = {
    key: apiKey,
    secret: apiSecret,
    passphrase: apiPassphrase,
  }

  const client = new ClobClient({
    host: "https://clob.polymarket.com",
    chain: Chain.POLYGON,
    signer,
    creds,
    builderConfig: { builderCode: builderAddress },
    funderAddress: process.env.POLYMARKET_FUNDER_ADDRESS || account.address,
  })

  // Fetch a live market to get a real token ID
  console.log("Fetching active markets from Gamma API...")
  const resp = await fetch(
    "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10"
  )
  if (!resp.ok) {
    console.error("Gamma API returned", resp.status)
    process.exit(1)
  }

  const markets: Record<string, unknown>[] = await resp.json()
  if (markets.length === 0) {
    console.error("No active markets found")
    process.exit(1)
  }

  // Pick the first market with clobTokenIds
  let market: Record<string, unknown> | null = null
  let tokenId = ""
  for (const m of markets) {
    const raw = m.clobTokenIds as string | undefined
    if (!raw) continue
    try {
      const ids: string[] = JSON.parse(raw)
      if (ids.length > 0) {
        market = m
        tokenId = ids[0]
        break
      }
    } catch {
      continue
    }
  }

  if (!market || !tokenId) {
    console.error("Could not find a market with clobTokenIds")
    process.exit(1)
  }

  const question = (market.question as string) || "Unknown"
  console.log(`Using market: ${question}`)
  console.log(`Token ID: ${tokenId}\n`)

  // Construct and sign the order
  console.log("Signing order with V2 builder field...")
  const userOrder = {
    tokenID: tokenId,
    price: 0.05,
    size: 1,
    side: 0, // BUY
    builderCode: builderAddress,
  }

  let signedOrder: Record<string, unknown>
  try {
    signedOrder = await client.createOrder(userOrder) as Record<string, unknown>
  } catch (err) {
    console.error("createOrder failed:", err instanceof Error ? err.message : err)
    process.exit(1)
  }

  console.log("\n=== Signed Order Payload ===\n")
  console.log(JSON.stringify(signedOrder, null, 2))

  // Assert the builder field
  const builder = signedOrder.builder as string | undefined
  console.log("\n=== Assertions ===\n")
  console.log("builder field:", builder || "(missing)")

  if (!builder) {
    console.error("FAIL: builder field is missing from the signed order")
    process.exit(1)
  }

  if (builder.toLowerCase() !== builderAddress.toLowerCase()) {
    console.error(`FAIL: builder field mismatch. Expected ${builderAddress}, got ${builder}`)
    process.exit(1)
  }

  console.log("PASS: builder field matches POLYMARKET_BUILDER_CODE")
  console.log("PASS: order was signed successfully")
  console.log("PASS: no real order was broadcast (dry-run verification)")
  console.log("\nAll assertions passed. The V2 routing pipeline is correctly wired.")
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
