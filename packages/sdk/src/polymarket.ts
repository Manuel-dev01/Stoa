import { ClobClient, Chain, Side, SignatureTypeV2 } from '@polymarket/clob-client-v2'
import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { StoaConfig, RouteOrderParams, SignedOrderPayload, MarketTokenIds } from './types.js'

function getClient(config: StoaConfig): ClobClient {
  const key = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = config.polygonRpc || 'https://polygon-bor-rpc.publicnode.com'
  const signer = createWalletClient({ account, transport: http(polygonRpc) })

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
    signatureType: SignatureTypeV2.EOA,
  })
}

export async function buildSignedOrder(
  config: StoaConfig,
  params: RouteOrderParams,
): Promise<SignedOrderPayload> {
  const client = getClient(config)
  const key = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
  const account = privateKeyToAccount(key as `0x${string}`)

  const userOrder = {
    tokenID: params.tokenId,
    price: params.price,
    size: params.size,
    side: params.side === 'BUY' ? Side.BUY : Side.SELL,
    builderCode: config.polymarket.builderCode,
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
    builderCode: config.polymarket.builderCode,
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
  const resp = await fetch(
    'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100',
  )
  if (!resp.ok) return null
  const markets: Record<string, unknown>[] = await resp.json()
  const found = markets.find(
    (m) =>
      ((m.conditionId as string) || (m.condition_id as string) || '').toLowerCase() ===
      conditionId.toLowerCase(),
  )
  if (!found) return null

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
