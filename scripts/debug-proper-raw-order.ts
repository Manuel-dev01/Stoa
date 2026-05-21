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
  account: ReturnType<typeof privateKeyToAccount>,
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

  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const BUILDER = '0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6'
  const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'

  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

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

  // For a BUY at price 0.05, size 1, tick_size 0.01:
  // makerAmount = price * size * 1e6 = 0.05 * 1 * 1e6 = 50000 (USDC)
  // takerAmount = size * 1e6 = 1 * 1e6 = 1000000 (outcome tokens)
  const makerAmount = '50000'   // 0.05 USDC
  const takerAmount = '1000000' // 1 outcome token

  // Test A: signer=EOA, maker=proxy (what SDK produces after patch)
  console.log('\n=== Test A: signer=EOA, maker=PROXY, sigType=3 ===')
  const orderA = {
    salt: Math.floor(Math.random() * 1e16),
    maker: PROXY,
    signer: agentAccount.address,
    tokenId,
    makerAmount,
    takerAmount,
    side: 0, // BUY as integer
    signatureType: 3,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    expiration: '0',
    metadata: BYTES32_ZERO,
    builder: BUILDER,
    signature: '0x' + '00'.repeat(65), // garbage sig
  }
  let r = await postOrder(agentAccount, agentCreds, orderA)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 500))

  // Test B: signer=PROXY, maker=PROXY (per docs: "both maker and signer must be deposit wallet")
  console.log('\n=== Test B: signer=PROXY, maker=PROXY, sigType=3 ===')
  const orderB = { ...orderA, signer: PROXY }
  r = await postOrder(agentAccount, agentCreds, orderB)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 500))

  // Test C: signer=EOA, maker=PROXY, sigType=3, side as string "BUY"
  console.log('\n=== Test C: signer=EOA, maker=PROXY, sigType=3, side="BUY" ===')
  const orderC = { ...orderA, side: 'BUY' }
  r = await postOrder(agentAccount, agentCreds, orderC)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 500))

  // Test D: signer=PROXY, maker=PROXY, sigType=3, side as string "BUY"
  console.log('\n=== Test D: signer=PROXY, maker=PROXY, sigType=3, side="BUY" ===')
  const orderD = { ...orderA, signer: PROXY, side: 'BUY' }
  r = await postOrder(agentAccount, agentCreds, orderD)
  console.log('Status:', r.status)
  console.log('Response:', r.body.slice(0, 500))
}

main().catch(console.error)
