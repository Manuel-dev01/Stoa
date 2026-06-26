/**
 * Polymarket market reads.
 *
 * Stoa no longer routes Polymarket orders — the monetization rail is the
 * x402 feed toll, not builder fees. This module is read-only: it discovers
 * markets and token IDs that the Triad reasons over.
 */
import type { MarketTokenIds, ActiveMarket } from './types.js'

export async function getMarketTokenIds(conditionId: string): Promise<MarketTokenIds | null> {
  // Gamma's list endpoint caps `limit` at 100 per page and silently ignores
  // a condition_id query param, so we paginate up to 500 active markets and
  // filter client-side. Mirrors apps/agent/stoa_agent/polymarket/gamma.py.
  const target = conditionId.toLowerCase()

  for (let offset = 0; offset < 500; offset += 100) {
    const resp = await fetch(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&offset=${offset}`,
    )
    if (!resp.ok) return null
    const markets: Record<string, unknown>[] = await resp.json()
    if (markets.length === 0) break

    const found = markets.find(
      (m) =>
        ((m.conditionId as string) || (m.condition_id as string) || '').toLowerCase() === target,
    )
    if (!found) continue

    const raw = found.clobTokenIds as string
    const tokenIds: string[] = JSON.parse(raw)
    const outcomes: string[] = JSON.parse(found.outcomes as string)

    const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === 'yes')
    const noIndex = outcomes.findIndex((o) => o.toLowerCase() === 'no')

    return {
      yesTokenId: tokenIds[yesIndex] || tokenIds[0],
      noTokenId: tokenIds[noIndex] || tokenIds[1],
      question: (found.question as string) || '',
    }
  }

  return null
}

/** Fetch active Polymarket markets, normalized to the cross-venue ActiveMarket
 *  shape used by getActiveMarkets(). Paginates Gamma up to 500 markets and
 *  filters by minLiquidity. */
export async function getActivePolymarketMarkets(opts?: {
  minLiquidity?: number
  pages?: number
}): Promise<ActiveMarket[]> {
  const minLiquidity = opts?.minLiquidity ?? 1000
  const pages = opts?.pages ?? 5
  const results: ActiveMarket[] = []

  for (let offset = 0; offset < pages * 100; offset += 100) {
    const resp = await fetch(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&offset=${offset}`,
    )
    if (!resp.ok) break
    const page: Record<string, unknown>[] = await resp.json()
    if (page.length === 0) break

    for (const m of page) {
      const conditionId = (m.conditionId as string) || (m.condition_id as string) || ''
      if (!conditionId) continue
      if (m.closed === true) continue
      const liquidity = Number(m.liquidity ?? 0)
      if (liquidity < minLiquidity) continue

      let outcomes: string[] = []
      let tokenIds: string[] = []
      try {
        outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes as string) : []
        tokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds as string) : []
      } catch {
        continue
      }

      const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === 'yes')
      const noIndex = outcomes.findIndex((o) => o.toLowerCase() === 'no')

      results.push({
        venue: 'polymarket',
        marketId: conditionId,
        question: (m.question as string) || '',
        endDate: (m.endDate as string) || (m.end_date as string) || null,
        outcomes,
        liquidity,
        yesTokenId: tokenIds[yesIndex >= 0 ? yesIndex : 0],
        noTokenId: tokenIds[noIndex >= 0 ? noIndex : 1],
      })
    }
  }

  return results
}
