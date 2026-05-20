import { ClobClient, Chain, Side } from "@polymarket/clob-client-v2"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

export interface RouteOrderParams {
  tokenId: string
  side: "BUY" | "SELL"
  price: number
  size: number
  agentBytes32: string
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

function getClient(): ClobClient {
  const rawKey = process.env.POLYMARKET_PRIVATE_KEY
  if (!rawKey) throw new Error("POLYMARKET_PRIVATE_KEY not set")

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-rpc.com"
  const signer = createWalletClient({ account, transport: http(polygonRpc) })

  const creds = {
    key: process.env.POLYMARKET_API_KEY!,
    secret: process.env.POLYMARKET_API_SECRET!,
    passphrase: process.env.POLYMARKET_API_PASSPHRASE!,
  }

  const builderCode = process.env.POLYMARKET_BUILDER_ADDRESS
  if (!builderCode) throw new Error("POLYMARKET_BUILDER_ADDRESS not set")

  return new ClobClient({
    host: "https://clob.polymarket.com",
    chain: Chain.POLYGON,
    signer,
    creds,
    builderConfig: { builderCode },
    funderAddress: process.env.POLYMARKET_FUNDER_ADDRESS || account.address,
  })
}

export async function buildSignedOrder(
  params: RouteOrderParams
): Promise<SignedOrderPayload> {
  const client = getClient()
  const builderCode = process.env.POLYMARKET_BUILDER_ADDRESS!

  const userOrder = {
    tokenID: params.tokenId,
    price: params.price,
    size: params.size,
    side: params.side === "BUY" ? Side.BUY : Side.SELL,
    builderCode,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedOrder: any = await client.createOrder(userOrder)

  return {
    order: {
      salt: String(signedOrder.salt),
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: signedOrder.taker || "0x0000000000000000000000000000000000000000",
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      side: String(signedOrder.side),
      signatureType: Number(signedOrder.signatureType),
      timestamp: String(signedOrder.timestamp),
      expiration: String(signedOrder.expiration || "0"),
      metadata: signedOrder.metadata,
      builder: signedOrder.builder,
      signature: String(signedOrder.signature || ""),
    },
    owner: process.env.POLYMARKET_FUNDER_ADDRESS || "",
    orderType: "GTC",
    ownerAddress: process.env.POLYMARKET_FUNDER_ADDRESS || "",
    builderCode,
  }
}

export async function submitOrder(signedOrder: SignedOrderPayload): Promise<unknown> {
  const client = getClient()
  return client.postOrder(signedOrder as unknown as Parameters<typeof client.postOrder>[0])
}

export async function getMarketTokenIds(conditionId: string): Promise<{
  yesTokenId: string
  noTokenId: string
  question: string
} | null> {
  const resp = await fetch(
    `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100`
  )
  if (!resp.ok) return null
  const markets: Record<string, unknown>[] = await resp.json()
  const found = markets.find(
    (m) =>
      ((m.conditionId as string) || (m.condition_id as string) || "").toLowerCase() ===
      conditionId.toLowerCase()
  )
  if (!found) return null

  const raw = found.clobTokenIds as string
  const tokenIds: string[] = JSON.parse(raw)
  const outcomes: string[] = JSON.parse(found.outcomes as string)

  const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === "yes")
  const noIndex = outcomes.findIndex((o) => o.toLowerCase() === "no")

  return {
    yesTokenId: tokenIds[yesIndex] || tokenIds[0],
    noTokenId: tokenIds[noIndex] || tokenIds[1],
    question: (found.question as string) || "",
  }
}
