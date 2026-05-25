export const STOA_SDK_VERSION = '0.1.0'

export type {
  StoaConfig,
  RouteOrderParams,
  SignedOrderPayload,
  PublishTraceParams,
  MarketTokenIds,
  ActiveMarket,
  ActiveMarketsQuery,
} from './types.js'

export {
  buildSignedOrder,
  submitOrder,
  getMarketTokenIds,
  getActivePolymarketMarkets,
} from './polymarket.js'
export { getActiveKalshiMarkets } from './kalshi.js'
export { getActiveMarkets } from './markets.js'
export { publishTrace, hashTrace } from './traces.js'
export { registerAgent } from './register.js'
export { uploadToIrys } from './irys.js'
export { StoaAgent } from './agent.js'
export type { StoaAgentConfig, PublishResult } from './agent.js'
export type { RegisterResult } from './register.js'

export { STOA_REGISTRY, STOA_TREASURY, TraceSchema, PERSONAS, PERSONA_KEYS, getPersonaLabel } from '@stoa-agents/shared'
export type { Trace, Persona } from '@stoa-agents/shared'
