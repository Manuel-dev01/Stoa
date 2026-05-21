import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { ClobClient, Chain, SignatureTypeV2 } from '@polymarket/clob-client-v2'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  // Agent EOA key
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as `0x${string}`
  const agentAccount = privateKeyToAccount(agentKey)
  const agentSigner = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  // Signing wallet key
  const signingKey = (process.env.POLYMARKET_PRIVATE_KEY || '').startsWith('0x')
    ? process.env.POLYMARKET_PRIVATE_KEY as `0x${string}`
    : `0x${process.env.POLYMARKET_PRIVATE_KEY}` as `0x${string}`
  const signingAccount = privateKeyToAccount(signingKey)
  const signingSigner = createWalletClient({ account: signingAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  console.log('Agent EOA:', agentAccount.address)
  console.log('Signing EOA:', signingAccount.address)

  // Agent API key
  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

  // Signing wallet API key
  const signingCreds = {
    key: process.env.POLYMARKET_API_KEY || '',
    secret: process.env.POLYMARKET_API_SECRET || '',
    passphrase: process.env.POLYMARKET_API_PASSPHRASE || '',
  }

  // Check agent API key binding
  console.log('\n=== Agent API Key ===')
  const agentClient = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: agentSigner,
    creds: agentCreds,
  })

  try {
    const keys = await agentClient.getApiKeys()
    console.log('API keys for agent EOA:', JSON.stringify(keys, null, 2))
  } catch (e: any) {
    console.log('getApiKeys error:', e.message)
  }

  // Check signing wallet API key binding
  console.log('\n=== Signing Wallet API Key ===')
  const signingClient = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: signingSigner,
    creds: signingCreds,
  })

  try {
    const keys = await signingClient.getApiKeys()
    console.log('API keys for signing EOA:', JSON.stringify(keys, null, 2))
  } catch (e: any) {
    console.log('getApiKeys error:', e.message)
  }

  // Try to derive API key for agent EOA (in case we need a fresh one)
  console.log('\n=== Derive API Key for Agent EOA ===')
  try {
    const derived = await agentClient.createOrDeriveApiKey()
    console.log('Derived/created:', JSON.stringify(derived, null, 2))
  } catch (e: any) {
    console.log('createOrDeriveApiKey error:', e.message)
  }

  // Check balance/allowance for POLY_1271
  console.log('\n=== Balance/Allowance (POLY_1271) ===')
  const poly1271Client = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: agentSigner,
    creds: agentCreds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a',
  })

  try {
    const bal = await poly1271Client.getBalanceAllowance({ asset_type: 'COLLATERAL' })
    console.log('Balance/allowance:', JSON.stringify(bal, null, 2))
  } catch (e: any) {
    console.log('getBalanceAllowance error:', e.message)
  }

  // Check if deposit wallet is deployed
  console.log('\n=== Deposit Wallet Code ===')
  const code = await agentSigner.request({
    method: 'eth_getCode',
    params: ['0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a', 'latest'],
  })
  console.log('Code length:', (code as string).length, 'chars')
  console.log('Is deployed:', (code as string) !== '0x' && (code as string).length > 2)
}

main().catch(console.error)
