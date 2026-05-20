import { NextRequest, NextResponse } from "next/server"
import { buildSignedOrder, getMarketTokenIds, type RouteOrderParams } from "@/lib/polymarket"

interface RouteOrderBody {
  marketId: string
  side: "BUY" | "SELL"
  price: number
  size: number
  agentBytes32: string
  dryRun?: boolean
}

export async function POST(req: NextRequest) {
  let body: RouteOrderBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { marketId, side, price, size, agentBytes32, dryRun = true } = body

  if (!marketId || !side || !price || !size || !agentBytes32) {
    return NextResponse.json(
      { error: "Missing required fields: marketId, side, price, size, agentBytes32" },
      { status: 400 }
    )
  }

  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 })
  }

  if (price <= 0 || price >= 1) {
    return NextResponse.json({ error: "price must be between 0 and 1" }, { status: 400 })
  }

  if (size <= 0) {
    return NextResponse.json({ error: "size must be positive" }, { status: 400 })
  }

  // Resolve market token IDs from Gamma API
  const marketInfo = await getMarketTokenIds(marketId)
  if (!marketInfo) {
    return NextResponse.json(
      { error: `Market not found or inactive: ${marketId}` },
      { status: 404 }
    )
  }

  const tokenId = side === "BUY" ? marketInfo.yesTokenId : marketInfo.noTokenId

  const orderParams: RouteOrderParams = {
    tokenId,
    side,
    price,
    size,
    agentBytes32,
  }

  try {
    const signedOrder = await buildSignedOrder(orderParams)

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        market: marketInfo.question,
        order: signedOrder,
        message: "Order signed but NOT broadcast. Set dryRun: false to submit.",
      })
    }

    // Live submission (only when explicitly requested)
    const { submitOrder } = await import("@/lib/polymarket")
    const result = await submitOrder(signedOrder)
    return NextResponse.json({
      dryRun: false,
      market: marketInfo.question,
      order: signedOrder,
      result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Order construction failed: ${message}` }, { status: 500 })
  }
}
