/**
 * The public preview: the latest few synthesized feed items, stripped to their
 * structured fields + verifiable hashes. The prose (bull/bear/synthesis) is the
 * product and stays behind the 402 — the preview shows only the numbers a
 * skeptic can check on-chain, plus the Irys/Arc receipts to check them with.
 *
 * Server-only (reuses feed.ts's service-role read + latest-per-market dedupe).
 */
import { createClient } from "@supabase/supabase-js"
import { getFeedItems } from "./feed"

export interface PreviewItem {
  id: string
  market_id: string
  question: string
  venue: string
  rating: number
  confidence_bps: number
  kelly_fraction: number
  agent_breakdown:
    | Record<string, { rating: number; confidence_bps: number; penalty: number; note: string }>
    | null
  irys_hash: string | null
  trace_hash: string | null
  arc_tx_hash: string | null
  published_at: string
}

export interface ReceiptRow {
  tx_hash: string
  payer: string | null
  amount_usdc: number
  consumed_at: string
}

/** The most recent honored toll — real proof a machine paid. Public table. */
export async function getLatestReceipt(): Promise<ReceiptRow | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from("payment_receipts")
    .select("tx_hash, payer, amount_usdc, consumed_at")
    .order("consumed_at", { ascending: false })
    .limit(1)
  if (error) {
    console.error("[preview] getLatestReceipt:", error.message)
    return null
  }
  return (data?.[0] as ReceiptRow) ?? null
}

/** Per-architect real metrics for the Triad astrolabe, derived from the
 *  feed_items the pipeline actually produces. Each synthesis carries an
 *  `agent_breakdown` with all three agents' real confidence, so this is the
 *  meaningful source (only the Calibrator publishes on-chain, so per-agent
 *  `traces` table counts are unreliable). TRACES = syntheses the agent read,
 *  AVG CONF = mean of its agent_breakdown confidence, LATEST = newest item.
 *  Hit-rate and edge aren't computed anywhere, so they're never shown. */
export interface ArchitectStats {
  traces: number
  avgConfidenceBps: number | null
  latestAt: string | null
}
export type TriadStats = Record<"quantec" | "bayesian" | "calibrator", ArchitectStats>

const EMPTY_STATS: ArchitectStats = { traces: 0, avgConfidenceBps: null, latestAt: null }

interface RawFeedRow {
  published_at: string
  synthesis: {
    agent_breakdown?: Record<string, { confidence_bps?: number }>
  } | null
}

export async function getTriadStats(): Promise<TriadStats> {
  const result: TriadStats = {
    quantec: { ...EMPTY_STATS },
    bayesian: { ...EMPTY_STATS },
    calibrator: { ...EMPTY_STATS },
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return result
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from("feed_items")
    .select("published_at, synthesis")
    .order("published_at", { ascending: false })
    .limit(300)
  if (error) {
    console.error("[preview] getTriadStats:", error.message)
    return result
  }
  const rows = (data ?? []) as RawFeedRow[]

  for (const k of Object.keys(result) as (keyof TriadStats)[]) {
    let count = 0
    let sumConf = 0
    let latest: string | null = null
    for (const row of rows) {
      const a = row.synthesis?.agent_breakdown?.[k]
      if (!a || typeof a.confidence_bps !== "number") continue
      count++
      sumConf += a.confidence_bps
      if (!latest || row.published_at > latest) latest = row.published_at
    }
    if (count > 0) {
      result[k] = { traces: count, avgConfidenceBps: Math.round(sumConf / count), latestAt: latest }
    }
  }
  return result
}

export async function getPreviewItems(n = 3): Promise<PreviewItem[]> {
  const rows = await getFeedItems(n)
  return rows.map((r) => ({
    id: r.id,
    market_id: r.market_id,
    question: r.question,
    venue: r.venue,
    rating: r.rating,
    confidence_bps: r.confidence_bps,
    kelly_fraction: r.kelly_fraction,
    agent_breakdown: r.synthesis?.agent_breakdown ?? null,
    irys_hash: r.irys_hash,
    trace_hash: r.trace_hash,
    arc_tx_hash: r.arc_tx_hash,
    published_at: r.published_at,
  }))
}
