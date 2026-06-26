import type { Trace } from '@stoa-agents/shared'

export interface StoaConfig {
  /** EOA private key (0x-prefixed hex) */
  privateKey: string
  /** Arc testnet RPC URL */
  arcRpc: string
  /** Irys node URL for trace uploads */
  irysNodeUrl?: string
}

export interface PublishTraceParams {
  agentId: string
  marketId: string
  trace: Trace
  irysReceipt: string
}

export interface MarketTokenIds {
  yesTokenId: string
  noTokenId: string
  question: string
}

/** Normalized active-market record across Polymarket and Kalshi. The
 *  `marketId` is what the agent passes to `POST /api/v1/traces`. */
export interface ActiveMarket {
  venue: 'polymarket' | 'kalshi'
  /** Polymarket: `condition_id` (0x... bytes32). Kalshi: `kalshi:{event_ticker}`. */
  marketId: string
  question: string
  /** ISO 8601 timestamp, or null when the venue doesn't expose it (Kalshi /events). */
  endDate: string | null
  outcomes: string[]
  /** USD-equivalent liquidity. 0 when the venue doesn't expose it. */
  liquidity: number
  /** Polymarket only — handy so the dev can route immediately after publishing. */
  yesTokenId?: string
  noTokenId?: string
}

export interface ActiveMarketsQuery {
  /** Filter to a single venue. Default: both. */
  venue?: 'polymarket' | 'kalshi' | 'all'
  /** Minimum liquidity in USD. Polymarket-only filter; Kalshi rows are
   *  returned regardless because the /events endpoint doesn't expose liquidity. */
  minLiquidity?: number
  /** Max results returned. Default 50, capped at 200. */
  limit?: number
  /** Offset into the merged list. Default 0. */
  offset?: number
}
