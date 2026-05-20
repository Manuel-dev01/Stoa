/**
 * broadcast-one-order.ts
 *
 * Submits ONE real order to Polymarket with the agent's builder code.
 * This is the ONLY script that touches real money.
 * Requires --confirm-real-money flag to proceed.
 *
 * Usage:
 *   npx tsx scripts/broadcast-one-order.ts --confirm-real-money
 */

import { ClobClient } from "@polymarket/clob-client-v2"
import { Chain } from "@polymarket/clob-client-v2"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

async function main() {
  // Safety gate
  if (!process.argv.includes("--confirm-real-money")) {
    console.error("This script submits a REAL order to Polymarket.")
    console.error("It will spend REAL USDC.")
    console.error("")
    console.error("To proceed, run:")
    console.error("  npx tsx scripts/broadcast-one-order.ts --confirm-real-money")
    process.exit(1)
  }

  const rawKey = process.env.POLYMARKET_PRIVATE_KEY
  if (!rawKey) {
    console.error("POLYMARKET_PRIVATE_KEY not set")
    process.exit(1)
  }

  const apiKey = process.env.POLYMARKET_API_KEY
  const apiSecret = process.env.POLYMARKET_API_SECRET
  const apiPassphrase = process.env.POLYMARKET_API_PASSPHRASE
  const builderAddress = process.env.POLYMARKET_BUILDER_ADDRESS

  if (!apiKey || !apiSecret || !apiPassphrase) {
    console.error("Polymarket API credentials not set")
    process.exit(1)
  }

  if (!builderAddress) {
    console.error("POLYMARKET_BUILDER_ADDRESS not set")
    process.exit(1)
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-rpc.com"

  console.log("=== BROADCASTING REAL ORDER ===\n")
  console.log("Account:", account.address)
  console.log("Builder code:", builderAddress)
  console.log("Polygon RPC:", polygonRpc)
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

  // Fetch a live market
  console.log("Fetching active markets from Gamma API...")
  const resp = await fetch(
    "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10"
  )
  if (!resp.ok) {
    console.error("Gamma API returned", resp.status)
    process.exit(1)
  }

  const markets: Record<string, unknown>[] = await resp.json()
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
    console.error("No suitable market found")
    process.exit(1)
  }

  const question = (market.question as string) || "Unknown"
  console.log(`Market: ${question}`)
  console.log(`Token ID: ${tokenId}`)
  console.log(`Side: BUY @ $0.05 × 1 share ($0.05 total)\n`)

  // Construct and sign
  const userOrder = {
    tokenID: tokenId,
    price: 0.05,
    size: 1,
    side: 0, // BUY
    builderCode: builderAddress,
  }

  console.log("Signing order...")
  const signedOrder = await client.createOrder(userOrder)

  console.log("Builder field:", (signedOrder as Record<string, unknown>).builder || signedOrder.builder)

  console.log("\nSubmitting to Polymarket CLOB...")
  try {
    const result = await client.postOrder(signedOrder as Parameters<typeof client.postOrder>[0])
    console.log("\n=== ORDER SUBMITTED ===")
    console.log(JSON.stringify(result, null, 2))
    console.log("\nBuilder fee will accrue to:", builderAddress)
  } catch (err) {
    console.error("postOrder failed:", err instanceof Error ? err.message : err)
    console.error("\nCommon causes:")
    console.error("  - Insufficient USDC.e balance (fund wallet on Polygon)")
    console.error("  - Builder code not registered (check polymarket.com/settings)")
    console.error("  - API credentials invalid (re-run setup-clob-keys.ts)")
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
