import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildSignedOrder, getMarketTokenIds, type RouteOrderParams } from "@/lib/polymarket"

interface RouteOrderBody {
  marketId: string
  side: "BUY" | "SELL"
  price: number
  size: number
  agentBytes32: string
  dryRun?: boolean
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Look up the agent's registered Polymarket builder EOA from Supabase. The
// Stoa bytes32 agent_id is the on-chain identity; the builder code is a
// mutable off-chain association set at registration time. Returns null if the
// agent has no builder code (daemon agents, or agents whose owners haven't
// registered a builder at polymarket.com/settings).
async function getAgentBuilderCode(agentId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase
    .from("agents")
    .select("polymarket_builder_code")
    .eq("agent_id", agentId.toLowerCase())
    .maybeSingle()
  if (error) {
    console.error("[route-order] builder code lookup:", error.message)
    return null
  }
  return (data?.polymarket_builder_code as string | null) ?? null
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

  // Resolve the agent's registered Polymarket builder EOA. If the agent
  // hasn't registered one, the order signs with no builder attribution —
  // honest "N/A" rather than misattributing fees to the platform.
  const agentPolymarketBuilderCode = (await getAgentBuilderCode(agentBytes32)) ?? undefined

  const orderParams: RouteOrderParams = {
    tokenId,
    side,
    price,
    size,
    agentBytes32,
    agentPolymarketBuilderCode,
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
