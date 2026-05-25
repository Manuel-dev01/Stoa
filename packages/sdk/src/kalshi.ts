/**
 * Kalshi market discovery.
 *
 * Mirrors apps/agent/stoa_agent/kalshi/client.py — fetches active events from
 * Kalshi's /events endpoint (not /markets, which is dominated by auto-generated
 * parlay markets whose title is a concatenated outcome list). Returns the
 * canonical question text a human reader would expect.
 */
import type { ActiveMarket } from './types.js'

const KALSHI_BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2'

// Series prefixes that produce parlay-style synthetic markets. DeepSeek can't
// reason on these and Kalshi never populates volume / open_interest for them.
const PARLAY_PREFIXES = ['KXMVE', 'KXMV', 'KXSPORT']

interface KalshiEvent {
  event_ticker?: string
  ticker?: string
  series_ticker?: string
  title?: string
  sub_title?: string
}

/** Fetch active Kalshi events, normalized to the cross-venue ActiveMarket
 *  shape. Kalshi's /events endpoint doesn't expose liquidity or expiry, so
 *  liquidity is reported as 0 and endDate as null. */
export async function getActiveKalshiMarkets(opts?: {
  limit?: number
}): Promise<ActiveMarket[]> {
  const limit = opts?.limit ?? 100
  const fetchSize = Math.min(limit * 2, 200)

  try {
    const resp = await fetch(
      `${KALSHI_BASE_URL}/events?limit=${fetchSize}&status=open`,
    )
    if (!resp.ok) return []
    const data = (await resp.json()) as { events?: KalshiEvent[] }

    const markets: ActiveMarket[] = []
    for (const e of data.events ?? []) {
      const eventTicker = e.event_ticker || e.ticker || ''
      const seriesTicker = e.series_ticker || ''
      const title = e.title || e.sub_title || ''

      if (!eventTicker || !title) continue
      if (PARLAY_PREFIXES.some((p) => seriesTicker.startsWith(p))) continue
      if (PARLAY_PREFIXES.some((p) => eventTicker.startsWith(p))) continue

      // Reject parlay concatenations that slipped past the prefix check.
      const yesCount = (title.match(/,\s*yes /gi) || []).length
      if (yesCount >= 3) continue

      markets.push({
        venue: 'kalshi',
        marketId: `kalshi:${eventTicker}`,
        question: title,
        endDate: null,
        outcomes: ['Yes', 'No'],
        liquidity: 0,
      })
    }

    return markets.slice(0, limit)
  } catch {
    return []
  }
}
