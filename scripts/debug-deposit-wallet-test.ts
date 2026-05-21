import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { ClobClient, Chain, SignatureTypeV2, Side, AssetType } from '@polymarket/clob-client-v2'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as `0x${string}`
  const agentAccount = privateKeyToAccount(agentKey)
  const agentSigner = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'

  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

  // Create client with POLY_1271 + deposit wallet
  const client = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: agentSigner,
    creds: agentCreds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: PROXY,
  })

  // Step 1: Update balance allowance (required before trading)
  console.log('=== Step 1: updateBalanceAllowance ===')
  try {
    const balResult = await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL })
    console.log('Balance update result:', JSON.stringify(balResult, null, 2))
  } catch (e: any) {
    console.log('updateBalanceAllowance error:', e.message)
  }

  // Step 2: Check balance
  console.log('\n=== Step 2: getBalanceAllowance ===')
  try {
    const bal = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL })
    console.log('Balance:', JSON.stringify(bal, null, 2))
  } catch (e: any) {
    console.log('getBalanceAllowance error:', e.message)
  }

  // Step 3: Fetch a market
  console.log('\n=== Step 3: Fetch market ===')
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

  // Step 4: Get tick size
  console.log('\n=== Step 4: Get tick size ===')
  let tickSize = '0.01'
  try {
    tickSize = await client.getTickSize(tokenId)
    console.log('Tick size:', tickSize)
  } catch (e: any) {
    console.log('getTickSize error:', e.message)
  }

  // Step 5: Create and post order
  console.log('\n=== Step 5: createAndPostOrder ===')
  try {
    const result = await client.createAndPostOrder(
      {
        tokenID: tokenId,
        price: 0.05,
        size: 1,
        side: Side.BUY,
      },
      { tickSize, negRisk: false },
    )
    console.log('Order result:', JSON.stringify(result, null, 2))
  } catch (e: any) {
    console.log('createAndPostOrder error:', e.message)
    console.log('Full error:', e)
  }
}

main().catch(console.error)
