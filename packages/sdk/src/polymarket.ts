/**
 * Polymarket V2 order routing.
 *
 * Production-ready for mainnet: when Arc and Polygon share the same chain,
 * orders signed here will submit to the CLOB with the agent's builder code.
 * On testnet, use buildSignedOrder() to verify signing; submission will fail
 * due to cross-chain mismatch (Arc testnet != Polygon mainnet).
 */
import { ClobClient, Chain, Side, SignatureTypeV2 } from '@polymarket/clob-client-v2'
import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { StoaConfig, RouteOrderParams, SignedOrderPayload, MarketTokenIds, ActiveMarket } from './types.js'

const DEPOSIT_WALLET = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'

function getClient(config: StoaConfig): ClobClient {
  const key = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = config.polygonRpc || 'https://polygon-bor-rpc.publicnode.com'
  const signer = createWalletClient({ account, transport: http(polygonRpc) })

  // Use POLY_1271 signature type with deposit wallet
  // Both maker and signer will be set to the deposit wallet address
  return new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer,
    creds: {
      key: config.polymarket.apiKey,
      secret: config.polymarket.apiSecret,
      passphrase: config.polymarket.apiPassphrase,
    },
    builderConfig: { builderCode: config.polymarket.builderCode },
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: DEPOSIT_WALLET,
  })
}

export async function buildSignedOrder(
  config: StoaConfig,
  params: RouteOrderParams,
): Promise<SignedOrderPayload> {
  const client = getClient(config)
  const key = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
  const account = privateKeyToAccount(key as `0x${string}`)

  // Builder code attribution: prefer the agent's registered Polymarket builder
  // EOA (the address the agent owner registered at polymarket.com/settings).
  // The Stoa bytes32 agent_id is NOT a builder code — Polymarket won't
  // recognize it — so we keep it for audit only and use the registered EOA
  // here. Falls back to the app-level code for legacy/unregistered agents.
  const builderCode =
    params.agentPolymarketBuilderCode || config.polymarket.builderCode

  const userOrder = {
    tokenID: params.tokenId,
    price: params.price,
    size: params.size,
    side: params.side === 'BUY' ? Side.BUY : Side.SELL,
    builderCode,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedOrder: any = await client.createOrder(userOrder)

  return {
    order: {
      salt: String(signedOrder.salt),
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: signedOrder.taker || '0x0000000000000000000000000000000000000000',
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      side: String(signedOrder.side),
      signatureType: Number(signedOrder.signatureType),
      timestamp: String(signedOrder.timestamp),
      expiration: String(signedOrder.expiration || '0'),
      metadata: signedOrder.metadata,
      builder: signedOrder.builder,
      signature: String(signedOrder.signature || ''),
    },
    owner: account.address,
    orderType: 'GTC',
    ownerAddress: account.address,
    builderCode,
  }
}

export async function submitOrder(
  config: StoaConfig,
  signedOrder: SignedOrderPayload,
): Promise<unknown> {
  const client = getClient(config)
  return client.postOrder(signedOrder as unknown as Parameters<typeof client.postOrder>[0])
}

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
