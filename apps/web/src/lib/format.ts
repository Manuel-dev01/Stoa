/**
 * Client-safe formatting helpers for the Triad's structured output.
 *
 * The feed stores `rating` (-3..+3), `confidence_bps`, `kelly_fraction`, and
 * per-agent `agent_breakdown` — nothing else. We render those fields directly;
 * we never synthesize a market probability or "edge" the daemon didn't emit.
 */

/** BUY +n / SELL -n / HOLD — the call, in the feed's own vocabulary. */
export function stanceLabel(rating: number): string {
  if (rating > 0) return `BUY +${rating}`
  if (rating < 0) return `SELL ${rating}`
  return "HOLD"
}

/** back / fade / hold — the App-Flow vocabulary for the same rating sign. */
export function stanceWord(rating: number): "back" | "fade" | "hold" {
  if (rating > 0) return "back"
  if (rating < 0) return "fade"
  return "hold"
}

export function confidencePct(bps: number): number {
  return Math.round(bps / 100)
}

export function shortHash(hash: string | null | undefined, lead = 6, tail = 4): string {
  if (!hash) return "—"
  if (hash.length <= lead + tail + 1) return hash
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`
}

export function irysUrl(hash: string | null | undefined): string | null {
  return hash ? `https://gateway.irys.xyz/${hash}` : null
}
