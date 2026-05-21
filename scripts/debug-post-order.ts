/**
 * debug-post-order.ts
 * Posts an order via raw HTTP to see the exact error response.
 */
import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { ClobClient, SignatureTypeV2, Side } from '@polymarket/clob-client-v2'
import { createHmac } from 'crypto'

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function main() {
  const key = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as `0x${string}`
  const account = privateKeyToAccount(key)
  const signer = createWalletClient({ account, transport: http('https://polygon-bor-rpc.publicnode.com') })
  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const BUILDER = '0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6'

  const creds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

  const client = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: polygon.id,
    signer,
    creds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: PROXY,
    builderConfig: { builderCode: BUILDER },
  })

  // Fetch a market
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

  // Create order (SDK sets signer = deposit wallet)
  const order = await client.createOrder({
    tokenID: tokenId,
    price: 0.05,
    size: 1,
    side: Side.BUY,
    builderCode: BUILDER,
  })

  console.log('SDK order signer:', order.signer)
  console.log('SDK order maker:', order.maker)

  // Test 1: Post with SDK (signer = deposit wallet)
  console.log('\n=== Test 1: SDK postOrder (signer = deposit wallet) ===')
  try {
    const result = await client.postOrder(order)
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.log('Error:', err.message)
  }

  // Test 2: Post via raw HTTP with signer = deposit wallet
  console.log('\n=== Test 2: Raw HTTP (signer = deposit wallet) ===')
  const orderPayload1 = {
    order: {
      salt: parseInt(order.salt, 10),
      maker: order.maker,
      signer: order.signer,
      taker: (order as any).taker,
      tokenId: order.tokenId,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      side: order.side,
      signatureType: order.signatureType,
      timestamp: order.timestamp,
      expiration: order.expiration,
      metadata: order.metadata,
      builder: order.builder,
      signature: order.signature,
    },
    owner: creds.key,
    orderType: 'GTC',
  }
  const body1 = JSON.stringify(orderPayload1)
  const ts1 = Math.floor(Date.now() / 1000)
  const hmac1 = createHmac('sha256', creds.secret).update(ts1 + 'POST' + '/order' + body1).digest()
  const headers1 = {
    POLY_ADDRESS: account.address,
    POLY_SIGNATURE: base64url(hmac1),
    POLY_TIMESTAMP: ts1.toString(),
    POLY_API_KEY: creds.key,
    POLY_PASSPHRASE: creds.passphrase,
    'Content-Type': 'application/json',
  }
  const postResp1 = await fetch('https://clob.polymarket.com/order', { method: 'POST', headers: headers1, body: body1 })
  console.log('Status:', postResp1.status)
  console.log('Response:', (await postResp1.text()).slice(0, 500))

  // Test 3: Post via raw HTTP with signer = EOA
  console.log('\n=== Test 3: Raw HTTP (signer = EOA) ===')
  const orderPayload2 = JSON.parse(JSON.stringify(orderPayload1))
  orderPayload2.order.signer = account.address
  const body2 = JSON.stringify(orderPayload2)
  const ts2 = Math.floor(Date.now() / 1000)
  const hmac2 = createHmac('sha256', creds.secret).update(ts2 + 'POST' + '/order' + body2).digest()
  const headers2 = {
    POLY_ADDRESS: account.address,
    POLY_SIGNATURE: base64url(hmac2),
    POLY_TIMESTAMP: ts2.toString(),
    POLY_API_KEY: creds.key,
    POLY_PASSPHRASE: creds.passphrase,
    'Content-Type': 'application/json',
  }
  const postResp2 = await fetch('https://clob.polymarket.com/order', { method: 'POST', headers: headers2, body: body2 })
  console.log('Status:', postResp2.status)
  console.log('Response:', (await postResp2.text()).slice(0, 500))

  // Test 4: Post via raw HTTP with POLY_ADDRESS = deposit wallet
  console.log('\n=== Test 4: Raw HTTP (POLY_ADDRESS = deposit wallet, signer = deposit wallet) ===')
  const body3 = JSON.stringify(orderPayload1)
  const ts3 = Math.floor(Date.now() / 1000)
  const hmac3 = createHmac('sha256', creds.secret).update(ts3 + 'POST' + '/order' + body3).digest()
  const headers3 = {
    POLY_ADDRESS: PROXY,
    POLY_SIGNATURE: base64url(hmac3),
    POLY_TIMESTAMP: ts3.toString(),
    POLY_API_KEY: creds.key,
    POLY_PASSPHRASE: creds.passphrase,
    'Content-Type': 'application/json',
  }
  const postResp3 = await fetch('https://clob.polymarket.com/order', { method: 'POST', headers: headers3, body: body3 })
  console.log('Status:', postResp3.status)
  console.log('Response:', (await postResp3.text()).slice(0, 500))
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
