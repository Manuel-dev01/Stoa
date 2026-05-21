import { createWalletClient, http, type WalletClient } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { createHmac } from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function postRawOrder(
  signer: WalletClient,
  account: PrivateKeyAccount,
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
    POLY_ADDRESS: account.address,
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
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as `0x${string}`
  const agentAccount = privateKeyToAccount(agentKey)
  const agentSigner = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const signingKey = (process.env.POLYMARKET_PRIVATE_KEY!.startsWith('0x')
    ? process.env.POLYMARKET_PRIVATE_KEY
    : `0x${process.env.POLYMARKET_PRIVATE_KEY}`) as `0x${string}`
  const signingAccount = privateKeyToAccount(signingKey)

  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const ZERO = '0x0000000000000000000000000000000000000000'
  const BUILDER = '0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6'
  const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'

  // Fetch a token ID
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

  // Test 1: agent creds, signer=EOA, maker=proxy, taker=zero, sigType=3
  console.log('\n=== Test 1: agent creds, signer=EOA, maker=proxy, taker=ZERO, sigType=3 ===')
  const order1 = {
    salt: Math.floor(Math.random() * 1e16).toString(),
    maker: PROXY,
    signer: agentAccount.address,
    taker: ZERO,
    tokenId,
    makerAmount: '100',
    takerAmount: '2000',
    side: 'BUY',
    signatureType: 3,
    timestamp: Date.now().toString(),
    expiration: '0',
    metadata: BYTES32_ZERO,
    builder: BUILDER,
    signature: '0x' + '00'.repeat(65),
  }
  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }
  let r = await postRawOrder(agentSigner, agentAccount, agentCreds, order1)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 300))

  // Test 2: signing wallet creds, signer=signingEOA, maker=proxy, taker=zero, sigType=3
  console.log('\n=== Test 2: signing creds, signer=signingEOA, maker=proxy, taker=ZERO, sigType=3 ===')
  const order2 = { ...order1, signer: signingAccount.address }
  const signingCreds = {
    key: process.env.POLYMARKET_API_KEY!,
    secret: process.env.POLYMARKET_API_SECRET!,
    passphrase: process.env.POLYMARKET_API_PASSPHRASE!,
  }
  r = await postRawOrder(createWalletClient({ account: signingAccount, transport: http('https://polygon-bor-rpc.publicnode.com') }), signingAccount, signingCreds, order2)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 300))

  // Test 3: agent creds, signer=EOA, maker=proxy, taker=ZERO, sigType=0 (EOA)
  console.log('\n=== Test 3: agent creds, signer=EOA, maker=proxy, taker=ZERO, sigType=0 (EOA) ===')
  const order3 = { ...order1, signatureType: 0 }
  r = await postRawOrder(agentSigner, agentAccount, agentCreds, order3)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 300))

  // Test 4: agent creds, signer=proxy, maker=proxy, taker=zero, sigType=3
  console.log('\n=== Test 4: agent creds, signer=PROXY, maker=PROXY, taker=ZERO, sigType=3 ===')
  const order4 = { ...order1, signer: PROXY }
  r = await postRawOrder(agentSigner, agentAccount, agentCreds, order4)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 300))

  // Test 5: agent creds, signer=EOA, maker=EOA, taker=zero, sigType=0
  console.log('\n=== Test 5: agent creds, signer=EOA, maker=EOA, taker=ZERO, sigType=0 ===')
  const order5 = { ...order1, maker: agentAccount.address, signatureType: 0 }
  r = await postRawOrder(agentSigner, agentAccount, agentCreds, order5)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 300))

  // Test 6: agent creds, signer=EOA, maker=proxy, taker=UNSET (no taker field), sigType=3
  console.log('\n=== Test 6: agent creds, signer=EOA, maker=proxy, NO TAKER, sigType=3 ===')
  const order6 = { ...order1 }
  delete (order6 as any).taker
  r = await postRawOrder(agentSigner, agentAccount, agentCreds, order6)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 300))
}

main().catch(console.error)
