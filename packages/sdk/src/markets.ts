/**
 * Cross-venue active-market discovery for external agents.
 *
 * This is the convenience layer external devs hit to get a normalized list of
 * markets they can opine on, without writing their own Polymarket Gamma or
 * Kalshi clients. Mirrors the daemon's discovery in apps/agent/stoa_agent.
 */
import { getActivePolymarketMarkets } from './polymarket.js'
import { getActiveKalshiMarkets } from './kalshi.js'
import type { ActiveMarket, ActiveMarketsQuery } from './types.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export async function getActiveMarkets(
  query: ActiveMarketsQuery = {},
): Promise<ActiveMarket[]> {
  const venue = query.venue ?? 'all'
  const minLiquidity = query.minLiquidity ?? 1000
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  const offset = Math.max(query.offset ?? 0, 0)

  const tasks: Promise<ActiveMarket[]>[] = []
  if (venue === 'all' || venue === 'polymarket') {
    tasks.push(getActivePolymarketMarkets({ minLiquidity }))
  }
  if (venue === 'all' || venue === 'kalshi') {
    // Pull a generous chunk so we can paginate the merged list below.
    tasks.push(getActiveKalshiMarkets({ limit: 200 }))
  }

  const results = await Promise.all(tasks)
  // Polymarket markets carry real liquidity; Kalshi carry 0. Sorting by
  // descending liquidity keeps the high-signal markets at the top.
  const merged = results.flat().sort((a, b) => b.liquidity - a.liquidity)
  return merged.slice(offset, offset + limit)
}
