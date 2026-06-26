/**
 * The macro-alpha feed: reads the Triad's published synthesis from Supabase
 * and shapes it into an RSSHub-friendly JSON Feed (jsonfeed.org 1.1) and an
 * RSS 2.0 XML serialization. Every item carries the synthesis, the Kelly
 * fraction, and the immutable Irys + Arc receipts so the data is verifiable.
 *
 * Server-only — uses the service-role key. Never import into a client bundle.
 */
import { createClient } from "@supabase/supabase-js"

const FEED_TITLE = "Stoa · Macro-Alpha"
const FEED_DESCRIPTION =
  "Cross-calibrated macro & crypto market predictions from the Stoa Triad (Quantec, Bayesian, Calibrator). Each item carries a fractional-Kelly stake and an immutable Irys trace hash."

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export interface FeedItemRow {
  id: string
  market_id: string
  question: string
  venue: string
  cycle: number
  rating: number
  confidence_bps: number
  kelly_fraction: number
  synthesis: {
    reasoning?: { bull?: string; bear?: string; synthesis?: string }
    agent_breakdown?: Record<string, { rating: number; confidence_bps: number; penalty: number; note: string }>
  }
  irys_hash: string | null
  trace_hash: string | null
  arc_tx_hash: string | null
  published_at: string
}

/** Latest synthesized item per market (one row per market, most recent cycle). */
export async function getFeedItems(limit = 25): Promise<FeedItemRow[]> {
  if (!supabaseUrl || !supabaseKey) return []
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase
    .from("feed_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit * 4) // over-fetch, then dedupe to latest-per-market below
  if (error) {
    console.error("[feed] getFeedItems:", error.message)
    return []
  }
  const seen = new Set<string>()
  const latest: FeedItemRow[] = []
  for (const row of (data ?? []) as FeedItemRow[]) {
    if (seen.has(row.market_id)) continue
    seen.add(row.market_id)
    latest.push(row)
    if (latest.length >= limit) break
  }
  return latest
}

function ratingLabel(rating: number): string {
  if (rating > 0) return `BUY +${rating}`
  if (rating < 0) return `SELL ${rating}`
  return "HOLD"
}

function itemTitle(item: FeedItemRow): string {
  return `${ratingLabel(item.rating)} · ${Math.round(item.confidence_bps / 100)}% · ${item.question}`
}

function itemContentText(item: FeedItemRow): string {
  const r = item.synthesis?.reasoning ?? {}
  return [
    `Rating: ${ratingLabel(item.rating)}`,
    `Confidence: ${Math.round(item.confidence_bps / 100)}%`,
    `Kelly fraction: ${item.kelly_fraction}`,
    "",
    r.synthesis ? `Synthesis: ${r.synthesis}` : "",
    r.bull ? `Bull: ${r.bull}` : "",
    r.bear ? `Bear: ${r.bear}` : "",
    "",
    item.irys_hash ? `Irys: ${item.irys_hash}` : "",
    item.arc_tx_hash ? `Arc tx: ${item.arc_tx_hash}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/** JSON Feed 1.1 — the shape RSSHub and most aggregators ingest natively. */
export function toJsonFeed(items: FeedItemRow[], feedUrl: string) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    home_page_url: "https://stoa-agents.vercel.app",
    feed_url: feedUrl,
    items: items.map((item) => ({
      id: item.trace_hash || item.id,
      url: item.irys_hash ? `https://gateway.irys.xyz/${item.irys_hash}` : undefined,
      title: itemTitle(item),
      content_text: itemContentText(item),
      date_published: item.published_at,
      // Machine-readable extension so bots can ingest the alpha without parsing prose.
      _stoa: {
        market_id: item.market_id,
        venue: item.venue,
        rating: item.rating,
        confidence_bps: item.confidence_bps,
        kelly_fraction: item.kelly_fraction,
        agent_breakdown: item.synthesis?.agent_breakdown ?? null,
        irys_hash: item.irys_hash,
        trace_hash: item.trace_hash,
        arc_tx_hash: item.arc_tx_hash,
      },
    })),
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** RSS 2.0 — for aggregators that want classic RSS rather than JSON Feed. */
export function toRssXml(items: FeedItemRow[], feedUrl: string): string {
  const entries = items
    .map((item) => {
      const link = item.irys_hash ? `https://gateway.irys.xyz/${item.irys_hash}` : feedUrl
      return `    <item>
      <title>${escapeXml(itemTitle(item))}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(item.trace_hash || item.id)}</guid>
      <pubDate>${new Date(item.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(itemContentText(item))}</description>
    </item>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>https://stoa-agents.vercel.app</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
${entries}
  </channel>
</rss>`
}
