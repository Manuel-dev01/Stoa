import type { Trace } from '@stoa/shared'

export interface StoaConfig {
  /** EOA private key (0x-prefixed hex) */
  privateKey: string
  /** Arc testnet RPC URL */
  arcRpc: string
  /** Polymarket CLOB credentials */
  polymarket: {
    apiKey: string
    apiSecret: string
    apiPassphrase: string
    builderCode: string
  }
  /** Polygon RPC URL (defaults to public RPC) */
  polygonRpc?: string
  /** Irys node URL for trace uploads */
  irysNodeUrl?: string
}

export interface RouteOrderParams {
  tokenId: string
  side: 'BUY' | 'SELL'
  price: number
  size: number
  /** Stoa agent identity (bytes32). Used for audit/logging only; not passed
   *  to Polymarket as the builder code. */
  agentBytes32: string
  /** Optional EOA the agent owner has registered as a Polymarket builder
   *  (polymarket.com/settings). If set, fees route to this address.
   *  If omitted, the order has no builder attribution. */
  agentPolymarketBuilderCode?: string
}

export interface SignedOrderPayload {
  order: {
    salt: string
    maker: string
    signer: string
    taker: string
    tokenId: string
    makerAmount: string
    takerAmount: string
    side: string
    signatureType: number
    timestamp: string
    expiration: string
    metadata: string
    builder: string
    signature: string
  }
  owner: string
  orderType: string
  ownerAddress: string
  builderCode: string
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
