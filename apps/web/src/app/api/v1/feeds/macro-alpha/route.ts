import { NextRequest, NextResponse } from "next/server"
import { getFeedItems, toJsonFeed, toRssXml } from "@/lib/feed"
import { paymentTerms, verifyAndConsumeReceipt } from "@/lib/x402"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/feeds/macro-alpha — the x402-gated Triad alpha feed.
 *
 *   No / invalid X-402-Payment-Receipt header → 402 + payment_terms.
 *   Valid receipt (settled on Arc, paid the toll to the Treasury, not replayed)
 *     → 200 + the feed (JSON Feed by default, RSS with ?format=rss).
 */
export async function GET(req: NextRequest) {
  const receipt =
    req.headers.get("x-402-payment-receipt") ||
    req.headers.get("X-402-Payment-Receipt") ||
    ""

  const { searchParams, origin, pathname } = new URL(req.url)
  const feedUrl = `${origin}${pathname}`

  if (!receipt) {
    return NextResponse.json(
      {
        error: "payment-required",
        message: "Pay the toll, then retry with the X-402-Payment-Receipt header.",
        payment_terms: paymentTerms(),
      },
      { status: 402 },
    )
  }

  const verdict = await verifyAndConsumeReceipt(receipt.trim())
  if (!verdict.ok) {
    return NextResponse.json(
      {
        error: "payment-invalid",
        reason: verdict.reason,
        payment_terms: paymentTerms(),
      },
      { status: 402 },
    )
  }

  const limit = Math.min(Number(searchParams.get("limit") || "25"), 100)
  const items = await getFeedItems(limit)
  const format = searchParams.get("format")

  if (format === "rss") {
    return new NextResponse(toRssXml(items, feedUrl), {
      status: 200,
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    })
  }

  return NextResponse.json(toJsonFeed(items, feedUrl), {
    status: 200,
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  })
}
