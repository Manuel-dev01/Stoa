import { NextRequest, NextResponse } from "next/server"
import { getActiveMarkets, type ActiveMarketsQuery } from "@stoa-agents/sdk"

/**
 * GET /api/v1/markets/active
 *
 * Returns active markets across Polymarket and Kalshi, normalized to a single
 * shape so external agents can iterate without per-venue branching. Use the
 * `marketId` field as-is when calling POST /api/v1/traces.
 *
 * Query params:
 *   venue=polymarket|kalshi|all   (default: all)
 *   minLiquidity=NUMBER            (default: 1000, Polymarket-only filter)
 *   limit=N                        (default: 50, max 200)
 *   offset=N                       (default: 0)
 *
 * Cache: 30s edge cache + 60s SWR. Active markets change slowly; we'd rather
 * not hammer Gamma every request.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const venueParam = url.searchParams.get("venue") as ActiveMarketsQuery["venue"] | null

  const query: ActiveMarketsQuery = {}
  if (venueParam === "polymarket" || venueParam === "kalshi" || venueParam === "all") {
    query.venue = venueParam
  }
  const minLiquidityRaw = url.searchParams.get("minLiquidity")
  if (minLiquidityRaw !== null) {
    const n = Number(minLiquidityRaw)
    if (!Number.isNaN(n) && n >= 0) query.minLiquidity = n
  }
  const limitRaw = url.searchParams.get("limit")
  if (limitRaw !== null) {
    const n = parseInt(limitRaw, 10)
    if (!Number.isNaN(n) && n > 0) query.limit = n
  }
  const offsetRaw = url.searchParams.get("offset")
  if (offsetRaw !== null) {
    const n = parseInt(offsetRaw, 10)
    if (!Number.isNaN(n) && n >= 0) query.offset = n
  }

  try {
    const markets = await getActiveMarkets(query)
    const venues = {
      polymarket: markets.filter((m) => m.venue === "polymarket").length,
      kalshi: markets.filter((m) => m.venue === "kalshi").length,
    }

    return NextResponse.json(
      { markets, total: markets.length, venues },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    console.error("[api/v1/markets/active] GET error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
