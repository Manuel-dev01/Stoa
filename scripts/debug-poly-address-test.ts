import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { createHmac } from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function postOrder(
  polyAddress: string,
  creds: { key: string; secret: string; passphrase: string },
  order: Record<string, unknown>
) {
  const orderPayload = {
    order,
    owner: creds.key,
    orderType: 'GTC',
    postOnly: false,
    deferExec: false,
  }

  const body = JSON.stringify(orderPayload)
  const ts = Math.floor(Date.now() / 1000)
  const hmac = createHmac('sha256', creds.secret)
    .update(ts + 'POST' + '/order' + body)
    .digest()

  const headers: Record<string, string> = {
    POLY_ADDRESS: polyAddress,
    POLY_SIGNATURE: base64url(hmac),
    POLY_TIMESTAMP: ts.toString(),
    POLY_API_KEY: creds.key,
    POLY_PASSPHRASE: creds.passphrase,
    'Content-Type': 'application/json',
  }

  const resp = await fetch('https://clob.polymarket.com/order', {
    method: 'POST',
    headers,
    body,
  })

  return { status: resp.status, body: await resp.text() }
}

async function main() {
  const EOA = '0x5b92F8A222704d522Fb3dCf8d734C3DAF51Fc4f1'
  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const BUILDER = '0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6'
  const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'

  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

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

  const makerAmount = '50000'
  const takerAmount = '1000000'

  // Test 1: POLY_ADDRESS=EOA, signer=EOA, maker=PROXY (standard)
  console.log('\n=== Test 1: POLY_ADDRESS=EOA, signer=EOA, maker=PROXY ===')
  let r = await postOrder(EOA, agentCreds, {
    salt: Math.floor(Math.random() * 1e16),
    maker: PROXY,
    signer: EOA,
    tokenId,
    makerAmount,
    takerAmount,
    side: 'BUY',
    signatureType: 3,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    expiration: '0',
    metadata: BYTES32_ZERO,
    builder: BUILDER,
    signature: '0x' + '00'.repeat(65),
  })
  console.log('Status:', r.status, '|', r.body.slice(0, 200))

  // Test 2: POLY_ADDRESS=PROXY, signer=EOA, maker=PROXY
  console.log('\n=== Test 2: POLY_ADDRESS=PROXY, signer=EOA, maker=PROXY ===')
  r = await postOrder(PROXY, agentCreds, {
    salt: Math.floor(Math.random() * 1e16),
    maker: PROXY,
    signer: EOA,
    tokenId,
    makerAmount,
    takerAmount,
    side: 'BUY',
    signatureType: 3,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    expiration: '0',
    metadata: BYTES32_ZERO,
    builder: BUILDER,
    signature: '0x' + '00'.repeat(65),
  })
  console.log('Status:', r.status, '|', r.body.slice(0, 200))

  // Test 3: POLY_ADDRESS=PROXY, signer=PROXY, maker=PROXY
  console.log('\n=== Test 3: POLY_ADDRESS=PROXY, signer=PROXY, maker=PROXY ===')
  r = await postOrder(PROXY, agentCreds, {
    salt: Math.floor(Math.random() * 1e16),
    maker: PROXY,
    signer: PROXY,
    tokenId,
    makerAmount,
    takerAmount,
    side: 'BUY',
    signatureType: 3,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    expiration: '0',
    metadata: BYTES32_ZERO,
    builder: BUILDER,
    signature: '0x' + '00'.repeat(65),
  })
  console.log('Status:', r.status, '|', r.body.slice(0, 200))

  // Test 4: POLY_ADDRESS=EOA, signer=PROXY, maker=PROXY
  console.log('\n=== Test 4: POLY_ADDRESS=EOA, signer=PROXY, maker=PROXY ===')
  r = await postOrder(EOA, agentCreds, {
    salt: Math.floor(Math.random() * 1e16),
    maker: PROXY,
    signer: PROXY,
    tokenId,
    makerAmount,
    takerAmount,
    side: 'BUY',
    signatureType: 3,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    expiration: '0',
    metadata: BYTES32_ZERO,
    builder: BUILDER,
    signature: '0x' + '00'.repeat(65),
  })
  console.log('Status:', r.status, '|', r.body.slice(0, 200))

  // Test 5: POLY_ADDRESS=EOA, signer=EOA, maker=PROXY, sigType=0
  console.log('\n=== Test 5: POLY_ADDRESS=EOA, signer=EOA, maker=PROXY, sigType=0 ===')
  r = await postOrder(EOA, agentCreds, {
    salt: Math.floor(Math.random() * 1e16),
    maker: PROXY,
    signer: EOA,
    tokenId,
    makerAmount,
    takerAmount,
    side: 'BUY',
    signatureType: 0,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    expiration: '0',
    metadata: BYTES32_ZERO,
    builder: BUILDER,
    signature: '0x' + '00'.repeat(65),
  })
  console.log('Status:', r.status, '|', r.body.slice(0, 200))
}

main().catch(console.error)
