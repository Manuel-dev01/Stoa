import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { ClobClient, Chain, SignatureTypeV2, Side, OrderType } from '@polymarket/clob-client-v2'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  // Use signing wallet (has its own API key)
  const key = (process.env.POLYMARKET_PRIVATE_KEY!.startsWith('0x')
    ? process.env.POLYMARKET_PRIVATE_KEY
    : `0x${process.env.POLYMARKET_PRIVATE_KEY}`) as `0x${string}`
  const account = privateKeyToAccount(key)
  const signer = createWalletClient({ account, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const creds = {
    key: process.env.POLYMARKET_API_KEY!,
    secret: process.env.POLYMARKET_API_SECRET!,
    passphrase: process.env.POLYMARKET_API_PASSPHRASE!,
  }

  console.log('EOA:', account.address)
  console.log('API Key:', creds.key)

  // Simple EOA client (no deposit wallet, no POLY_1271)
  const client = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer,
    creds,
  })

  // Fetch market
  const resp = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=5')
  const markets: Record<string, unknown>[] = await resp.json()
  let tokenId = ''
  let market: Record<string, unknown> | null = null
  for (const m of markets) {
    const raw = m.clobTokenIds as string | undefined
    if (!raw) continue
    try {
      const ids: string[] = JSON.parse(raw)
      if (ids.length > 0) { tokenId = ids[0]; market = m; break }
    } catch { continue }
  }
  console.log('Market:', (market as any)?.question)
  console.log('Token ID:', tokenId)

  // Get tick size
  const tickSize = await client.getTickSize(tokenId)
  console.log('Tick size:', tickSize)

  // Get neg risk
  const negRisk = await client.getNegRisk(tokenId)
  console.log('Neg risk:', negRisk)

  // Create order (plain EOA, no builder, no deposit wallet)
  console.log('\nCreating order...')
  try {
    const order = await client.createOrder({
      tokenID: tokenId,
      price: 0.05,
      size: 1,
      side: Side.BUY,
    }, { tickSize, negRisk })

    console.log('Order created successfully!')
    console.log('signer:', order.signer)
    console.log('maker:', order.maker)
    console.log('signatureType:', order.signatureType)
    console.log('builder:', order.builder)

    // Post order
    console.log('\nPosting order...')
    const result = await client.postOrder(order as Parameters<typeof client.postOrder>[0])
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (e: any) {
    console.log('Error:', e.message)
    console.log('Full error:', e)
  }
}

main().catch(console.error)
