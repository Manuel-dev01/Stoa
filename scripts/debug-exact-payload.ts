import { createWalletClient, http, type Hex } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { ClobClient, Chain, SignatureTypeV2, Side, OrderType } from '@polymarket/clob-client-v2'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const BUILDER = '0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6'

  // Use agent EOA
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as Hex
  const agentAccount = privateKeyToAccount(agentKey)
  const agentSigner = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

  console.log('Agent EOA:', agentAccount.address)

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
  console.log('Token ID:', tokenId)

  // Get tick size and neg risk
  const tempClient = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: agentSigner,
    creds: agentCreds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: PROXY,
  })

  const tickSize = await tempClient.getTickSize(tokenId)
  const negRisk = await tempClient.getNegRisk(tokenId)
  console.log('Tick size:', tickSize, '| Neg risk:', negRisk)

  // Log the full signed order
  console.log('\n=== Creating order with SDK ===')
  const order = await tempClient.createOrder({
    tokenID: tokenId,
    price: 0.05,
    size: 1,
    side: Side.BUY,
  }, { tickSize, negRisk })

  console.log('Signed order:')
  console.log('  salt:', order.salt)
  console.log('  maker:', order.maker)
  console.log('  signer:', order.signer)
  console.log('  taker:', (order as any).taker)
  console.log('  tokenId:', order.tokenId)
  console.log('  makerAmount:', order.makerAmount)
  console.log('  takerAmount:', order.takerAmount)
  console.log('  side:', order.side)
  console.log('  signatureType:', order.signatureType)
  console.log('  timestamp:', order.timestamp)
  console.log('  expiration:', order.expiration)
  console.log('  metadata:', order.metadata)
  console.log('  builder:', order.builder)
  console.log('  signature:', order.signature?.slice(0, 20) + '...')
  console.log('  signature length:', order.signature?.length)

  // Post with SDK
  console.log('\n=== Posting with SDK ===')
  try {
    const result = await tempClient.postOrder(order as Parameters<typeof tempClient.postOrder>[0])
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (e: any) {
    console.log('SDK postOrder error:', e.message)
  }
}

main().catch(console.error)
