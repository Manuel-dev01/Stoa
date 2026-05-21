import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { ClobClient, Chain, SignatureTypeV2 } from '@polymarket/clob-client-v2'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  // Agent EOA
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as `0x${string}`
  const agentAccount = privateKeyToAccount(agentKey)
  const agentSigner = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  // Signing wallet EOA
  const signingKey = (process.env.POLYMARKET_PRIVATE_KEY!.startsWith('0x')
    ? process.env.POLYMARKET_PRIVATE_KEY
    : `0x${process.env.POLYMARKET_PRIVATE_KEY}`) as `0x${string}`
  const signingAccount = privateKeyToAccount(signingKey)
  const signingSigner = createWalletClient({ account: signingAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  console.log('Agent EOA:', agentAccount.address)
  console.log('Signing EOA:', signingAccount.address)

  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

  const signingCreds = {
    key: process.env.POLYMARKET_API_KEY!,
    secret: process.env.POLYMARKET_API_SECRET!,
    passphrase: process.env.POLYMARKET_API_PASSPHRASE!,
  }

  // Check API keys for agent EOA
  console.log('\n=== Agent EOA API Keys ===')
  try {
    const c = new ClobClient({ host: 'https://clob.polymarket.com', chain: Chain.POLYGON, signer: agentSigner, creds: agentCreds })
    const keys = await c.getApiKeys()
    console.log(JSON.stringify(keys, null, 2))
  } catch (e: any) { console.log('Error:', e.message) }

  // Check API keys for signing EOA
  console.log('\n=== Signing EOA API Keys ===')
  try {
    const c = new ClobClient({ host: 'https://clob.polymarket.com', chain: Chain.POLYGON, signer: signingSigner, creds: signingCreds })
    const keys = await c.getApiKeys()
    console.log(JSON.stringify(keys, null, 2))
  } catch (e: any) { console.log('Error:', e.message) }

  // Try creating/deriving API key for agent EOA
  console.log('\n=== Create/Derive API Key for Agent EOA ===')
  try {
    const c = new ClobClient({ host: 'https://clob.polymarket.com', chain: Chain.POLYGON, signer: agentSigner })
    const creds = await c.createOrDeriveApiKey()
    console.log('Result:', JSON.stringify(creds, null, 2))
  } catch (e: any) { console.log('Error:', e.message) }

  // Try creating/deriving API key for signing EOA
  console.log('\n=== Create/Derive API Key for Signing EOA ===')
  try {
    const c = new ClobClient({ host: 'https://clob.polymarket.com', chain: Chain.POLYGON, signer: signingSigner })
    const creds = await c.createOrDeriveApiKey()
    console.log('Result:', JSON.stringify(creds, null, 2))
  } catch (e: any) { console.log('Error:', e.message) }
}

main().catch(console.error)
