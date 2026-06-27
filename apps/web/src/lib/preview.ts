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
