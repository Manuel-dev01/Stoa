/**
 * broadcast-proxy-order.ts
 *
 * Submits ONE real order using the deposit wallet (POLY_1271).
 * Overrides the order's signer to match the API key address (EOA).
 *
 * Usage:
 *   node --import tsx scripts/broadcast-proxy-order.ts --confirm-real-money
 */

import { ClobClient, SignatureTypeV2, Side } from "@polymarket/clob-client-v2"
import { createWalletClient, http } from "viem"
import { polygon } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

async function main() {
  if (!process.argv.includes("--confirm-real-money")) {
    console.error("This script submits a REAL order to Polymarket.")
    console.error("To proceed, run:")
    console.error("  node --import tsx scripts/broadcast-proxy-order.ts --confirm-real-money")
    process.exit(1)
  }

  const key = "0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40"
  const account = privateKeyToAccount(key as `0x${string}`)
  const PROXY = "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a"
  const BUILDER = "0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6"

  console.log("=== BROADCASTING REAL ORDER (POLY_1271) ===\n")
  console.log("Signer (EOA):", account.address)
  console.log("Maker (proxy):", PROXY)
  console.log("Builder:", BUILDER)
  console.log()

  const signer = createWalletClient({ account, transport: http("https://polygon-bor-rpc.publicnode.com") })
  const creds = {
    key: "7a658867-2edc-cc92-7c35-9f36475cda38",
    secret: "sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=",
    passphrase: "4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d",
  }

  const client = new ClobClient({
    host: "https://clob.polymarket.com",
    chain: polygon.id,
    signer,
    creds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: PROXY,
    builderConfig: { builderCode: BUILDER },
  })

  // Fetch a live market
  console.log("Fetching markets...")
  const resp = await fetch("https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10")
  const markets: Record<string, unknown>[] = await resp.json()

  let tokenId = ""
  let question = ""
  for (const m of markets) {
    const raw = m.clobTokenIds as string | undefined
    if (!raw) continue
    try {
      const ids: string[] = JSON.parse(raw)
      if (ids.length > 0) {
        tokenId = ids[0]
        question = (m.question as string) || "Unknown"
        break
      }
    } catch {
      continue
    }
  }

  if (!tokenId) {
    console.error("No market found")
    process.exit(1)
  }

  console.log(`Market: ${question}`)
  console.log(`Token ID: ${tokenId}`)
  console.log(`Side: BUY @ $0.05 x 1 share ($0.05 total)\n`)

  // Construct and sign order
  console.log("Signing order...")
  const userOrder = {
    tokenID: tokenId,
    price: 0.05,
    size: 1,
    side: Side.BUY,
    builderCode: BUILDER,
  }

  const signedOrder = await client.createOrder(userOrder)

  console.log("\n=== Signed Order ===")
  console.log("Maker:", signedOrder.maker)
  console.log("Signer:", signedOrder.signer)
  console.log("Signature type:", signedOrder.signatureType)
  console.log("Builder:", signedOrder.builder)

  // Log full signed order for debugging
  console.log("\n=== Full Signed Order ===")
  console.log(JSON.stringify(signedOrder, null, 2))

  // If signer is proxy but API key is EOA, override signer to EOA
  if (signedOrder.signer?.toLowerCase() === PROXY.toLowerCase()) {
    console.log("\n--- Overriding signer from proxy to EOA to match API key ---")
    ;(signedOrder as Record<string, unknown>).signer = account.address
    console.log("New signer:", signedOrder.signer)
  }

  // Log the payload that will be sent
  const orderPayload = {
    order: {
      salt: parseInt(signedOrder.salt, 10),
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: (signedOrder as any).taker,
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      side: signedOrder.side,
      signatureType: signedOrder.signatureType,
      timestamp: signedOrder.timestamp,
      expiration: signedOrder.expiration,
      metadata: signedOrder.metadata,
      builder: signedOrder.builder,
      signature: signedOrder.signature,
    },
    owner: "7a658867-2edc-cc92-7c35-9f36475cda38",
    orderType: "GTC",
  }
  console.log("\n=== Order Payload (what CLOB receives) ===")
  console.log(JSON.stringify(orderPayload, null, 2))

  // Post order
  console.log("\nSubmitting to Polymarket CLOB...")
  try {
    const result = await client.postOrder(signedOrder as Parameters<typeof client.postOrder>[0])
    console.log("\n=== ORDER SUBMITTED ===")
    console.log(JSON.stringify(result, null, 2))
    console.log("\nBuilder fee will accrue to:", BUILDER)
  } catch (err) {
    console.error("\npostOrder failed:", err instanceof Error ? err.message : err)
    if (err instanceof Error && (err as any).response) {
      const respText = await (err as any).response.text()
      console.error("Response:", respText)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
