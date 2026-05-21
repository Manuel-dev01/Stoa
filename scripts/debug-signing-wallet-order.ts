import { createWalletClient, http, type Hex } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { ClobClient, Chain, SignatureTypeV2, Side, OrderType, AssetType } from '@polymarket/clob-client-v2'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'

  // Use signing wallet
  const signingKey = (process.env.POLYMARKET_PRIVATE_KEY!.startsWith('0x')
    ? process.env.POLYMARKET_PRIVATE_KEY
    : `0x${process.env.POLYMARKET_PRIVATE_KEY}`) as Hex
  const signingAccount = privateKeyToAccount(signingKey)
  const signingSigner = createWalletClient({ account: signingAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const signingCreds = {
    key: process.env.POLYMARKET_API_KEY!,
    secret: process.env.POLYMARKET_API_SECRET!,
    passphrase: process.env.POLYMARKET_API_PASSPHRASE!,
  }

  console.log('Signing EOA:', signingAccount.address)
  console.log('API Key:', signingCreds.key)
  console.log('Deposit wallet:', PROXY)

  // Check API keys
  const tempClient = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: signingSigner,
    creds: signingCreds,
  })
  const keys = await tempClient.getApiKeys()
  console.log('API keys:', JSON.stringify(keys))

  // Create POLY_1271 client with signing wallet
  const client = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: signingSigner,
    creds: signingCreds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: PROXY,
  })

  // Update balance
  console.log('\n=== Updating balance ===')
  try {
    await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL })
    console.log('Balance updated')
  } catch (e: any) {
    console.log('Balance update error:', e.message)
  }

  // Check balance
  const bal = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL })
  console.log('Balance:', JSON.stringify(bal))

  // Fetch market
  const resp = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=5')
  const markets: Record<string, unknown>[] = await resp.json()
  let tokenId = ''
  for (const m of markets) {
    const raw = m.clobTokenIds as string | undefined
    if (!raw) continue
    try {
      const ids: string[] = JSON.parse(raw)
      if (ids.length > 0) { tokenId = ids[0]; break }
    } catch { continue }
  }

  const tickSize = await client.getTickSize(tokenId)
  const negRisk = await client.getNegRisk(tokenId)

  // Create and post order
  console.log('\n=== Creating order ===')
  try {
    const order = await client.createOrder({
      tokenID: tokenId,
      price: 0.05,
      size: 1,
      side: Side.BUY,
    }, { tickSize, negRisk })

    console.log('signer:', order.signer)
    console.log('maker:', order.maker)
    console.log('signatureType:', order.signatureType)

    const result = await client.postOrder(order as Parameters<typeof client.postOrder>[0])
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (e: any) {
    console.log('Error:', e.message)
  }
}

main().catch(console.error)
