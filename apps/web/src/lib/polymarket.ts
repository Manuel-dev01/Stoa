import {
  buildSignedOrder as sdkBuildSignedOrder,
  submitOrder as sdkSubmitOrder,
  getMarketTokenIds as sdkGetMarketTokenIds,
  type RouteOrderParams,
  type SignedOrderPayload,
  type StoaConfig,
} from '@stoa/sdk'

function getConfig(): StoaConfig {
  const rawKey = process.env.POLYMARKET_PRIVATE_KEY
  if (!rawKey) throw new Error('POLYMARKET_PRIVATE_KEY not set')

  return {
    privateKey: rawKey,
    arcRpc: process.env.ARC_RPC_URL || process.env.NEXT_PUBLIC_ARC_RPC || '',
    polygonRpc: process.env.POLYGON_RPC || 'https://polygon-bor-rpc.publicnode.com',
    polymarket: {
      apiKey: process.env.POLYMARKET_API_KEY!,
      apiSecret: process.env.POLYMARKET_API_SECRET!,
      apiPassphrase: process.env.POLYMARKET_API_PASSPHRASE!,
      builderCode: process.env.POLYMARKET_BUILDER_CODE!,
    },
  }
}

export type { RouteOrderParams, SignedOrderPayload }

export async function buildSignedOrder(params: RouteOrderParams): Promise<SignedOrderPayload> {
  return sdkBuildSignedOrder(getConfig(), params)
}

export async function submitOrder(signedOrder: SignedOrderPayload): Promise<unknown> {
  return sdkSubmitOrder(getConfig(), signedOrder)
}

export async function getMarketTokenIds(conditionId: string) {
  return sdkGetMarketTokenIds(conditionId)
}
