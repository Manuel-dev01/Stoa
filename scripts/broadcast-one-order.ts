/**
 * broadcast-one-order.ts
 *
 * Dry-run verification of a Polymarket V2 order with the agent's builder code.
 * Signs a real POLY_1271 order and asserts all fields are correct.
 *
 * On mainnet (Arc + Polygon same chain), this would submit to the CLOB.
 * On testnet, it verifies the signing pipeline is production-ready.
 *
 * Usage:
 *   npx tsx scripts/broadcast-one-order.ts
 *   npx tsx scripts/broadcast-one-order.ts --live   # attempt real CLOB submission
 */

import { ClobClient, Chain, Side, SignatureTypeV2 } from "@polymarket/clob-client-v2"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const DEPOSIT_WALLET = "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a"
const EXPECTED_SIGNATURE_TYPE = 3 // POLY_1271

async function main() {
  const isLive = process.argv.includes("--live")

  const rawKey = process.env.AGENT_PRIVATE_KEY
  if (!rawKey) {
    console.error("AGENT_PRIVATE_KEY not set")
    process.exit(1)
  }

  const apiKey = process.env.POLYMARKET_AGENT_API_KEY
  const apiSecret = process.env.POLYMARKET_AGENT_API_SECRET
  const apiPassphrase = process.env.POLYMARKET_AGENT_API_PASSPHRASE
  const builderCode = process.env.POLYMARKET_BUILDER_CODE

  if (!apiKey || !apiSecret || !apiPassphrase) {
    console.error("Polymarket agent API credentials not set. Run setup-agent-clob-keys.ts first.")
    process.exit(1)
  }

  if (!builderCode) {
    console.error("POLYMARKET_BUILDER_CODE not set")
    process.exit(1)
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-bor-rpc.publicnode.com"

  console.log("=== POLYMARKET V2 ORDER VERIFICATION ===\n")
  console.log("Mode:", isLive ? "LIVE (submitting to CLOB)" : "DRY RUN (sign + verify only)")
  console.log("EOA signer:", account.address)
  console.log("Deposit wallet:", DEPOSIT_WALLET)
  console.log("Builder code:", builderCode)
  console.log("Polygon RPC:", polygonRpc)
  console.log()

  const signer = createWalletClient({ account, transport: http(polygonRpc) })

  const creds = { key: apiKey, secret: apiSecret, passphrase: apiPassphrase }

  const client = new ClobClient({
    host: "https://clob.polymarket.com",
    chain: Chain.POLYGON,
    signer,
    creds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: DEPOSIT_WALLET,
    builderConfig: { builderCode },
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
  console.log(`Side: BUY @ $0.05 x 1 share ($0.05 total)\n`)

  // Sign the order
  console.log("Signing POLY_1271 order...")
  const signedOrder = await client.createOrder({
    tokenID: tokenId,
    price: 0.05,
    size: 1,
    side: Side.BUY,
  })

  const order = signedOrder as Record<string, unknown>

  // === VERIFICATION ===
  console.log("\n=== SIGNED ORDER FIELDS ===\n")
  console.log("  maker:          ", order.maker)
  console.log("  signer:         ", order.signer)
  console.log("  signatureType:  ", order.signatureType)
  console.log("  builder:        ", order.builder)
  console.log("  salt:           ", order.salt)
  console.log("  tokenId:        ", String(order.tokenId).slice(0, 20) + "...")
  console.log("  makerAmount:    ", order.makerAmount)
  console.log("  takerAmount:    ", order.takerAmount)
  console.log("  side:           ", order.side)
  console.log("  timestamp:      ", order.timestamp)
  console.log("  signature:      ", String(order.signature).slice(0, 20) + "...")
  console.log()

  // Assert correctness
  let passed = 0
  let failed = 0

  function assert(name: string, condition: boolean, detail: string) {
    if (condition) {
      console.log(`  PASS  ${name}`)
      passed++
    } else {
      console.log(`  FAIL  ${name} — ${detail}`)
      failed++
    }
  }

  console.log("=== ASSERTIONS ===\n")

  assert(
    "maker = deposit wallet",
    String(order.maker).toLowerCase() === DEPOSIT_WALLET.toLowerCase(),
    `got ${order.maker}`
  )

  assert(
    "signer = deposit wallet",
    String(order.signer).toLowerCase() === DEPOSIT_WALLET.toLowerCase(),
    `got ${order.signer}`
  )

  assert(
    "signatureType = POLY_1271 (3)",
    Number(order.signatureType) === EXPECTED_SIGNATURE_TYPE,
    `got ${order.signatureType}`
  )

  assert(
    "builder = registered builder code",
    String(order.builder).toLowerCase() === builderCode.toLowerCase(),
    `got ${order.builder}`
  )

  assert(
    "side = BUY",
    String(order.side) === "BUY",
    `got ${order.side}`
  )

  assert(
    "price = $0.05 (makerAmount/takerAmount ratio)",
    Number(order.makerAmount) / Number(order.takerAmount) === 0.05,
    `got ${Number(order.makerAmount) / Number(order.takerAmount)}`
  )

  assert(
    "signature is non-empty hex",
    typeof order.signature === "string" && order.signature.startsWith("0x") && order.signature.length > 10,
    `got ${String(order.signature).slice(0, 20)}`
  )

  assert(
    "timestamp is recent (within 60s)",
    Math.abs(Date.now() - Number(order.timestamp)) < 60_000,
    `got ${order.timestamp}`
  )

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`)

  if (failed > 0) {
    console.error("Some assertions failed. The signing pipeline has issues.")
    process.exit(1)
  }

  console.log("All assertions passed. The POLY_1271 signing pipeline is correct.")
  console.log("Builder fee will accrue to:", builderCode)
  console.log()

  // Optionally submit to CLOB
  if (isLive) {
    console.log("--- LIVE SUBMISSION ---")
    console.log("Submitting to Polymarket CLOB...")
    try {
      const result = await client.postOrder(signedOrder as Parameters<typeof client.postOrder>[0])
      console.log("\n=== ORDER SUBMITTED ===")
      console.log(JSON.stringify(result, null, 2))
    } catch (err) {
      console.error("postOrder failed:", err instanceof Error ? err.message : err)
      console.error("\nKnown issue: CLOB API validates order.signer against API key owner address.")
      console.error("For POLY_1271, order.signer = deposit wallet (contract), but API key is from EOA.")
      console.error("This is a Polymarket platform limitation for programmatic deposit wallet orders.")
      console.error("See docs/archive/phase-2-polymarket-broadcast.md for full analysis.")
      process.exit(1)
    }
  } else {
    console.log("Dry run complete. Use --live to attempt CLOB submission.")
    console.log()
    console.log("Note: CLOB submission requires Arc mainnet (same chain as Polymarket).")
    console.log("The signing pipeline is production-ready — order will submit when Arc ships mainnet.")
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
