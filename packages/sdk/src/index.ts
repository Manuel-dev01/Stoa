export const STOA_SDK_VERSION = '0.1.0'

export type {
  StoaConfig,
  RouteOrderParams,
  SignedOrderPayload,
  PublishTraceParams,
  MarketTokenIds,
} from './types.js'

export { buildSignedOrder, submitOrder, getMarketTokenIds } from './polymarket.js'
export { publishTrace, hashTrace } from './traces.js'

export { STOA_REGISTRY, STOA_TREASURY, TraceSchema } from '@stoa/shared'
export type { Trace } from '@stoa/shared'
