import { createWalletClient, http, type Hex } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { createHmac } from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function main() {
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as Hex
  const agentAccount = privateKeyToAccount(agentKey)
  const agentSigner = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const EOA = agentAccount.address

  // Try to create API key with deposit wallet address in L1 auth
  // The L1 auth EIP-712 message has an "address" field
  // If we pass the deposit wallet address, the CLOB might bind the key to it

  console.log('EOA:', EOA)
  console.log('Deposit wallet:', PROXY)

  // Step 1: Try to create API key with deposit wallet address
  // The SDK's createApiKey doesn't accept an address parameter
  // But the raw API does - let's try

  const ts = Math.floor(Date.now() / 1000)
  const nonce = 0

  // Build EIP-712 signature with deposit wallet address
  const domain = {
    name: 'ClobAuthDomain',
    version: '1',
    chainId: 137,
  }
  const types = {
    ClobAuth: [
      { name: 'address', type: 'address' },
      { name: 'timestamp', type: 'string' },
      { name: 'nonce', type: 'uint256' },
      { name: 'message', type: 'string' },
    ],
  }

  // Try with deposit wallet address in the message
  const messageWithProxy = {
    address: PROXY,
    timestamp: ts.toString(),
    nonce: nonce,
    message: 'This message attests that I control the given wallet',
  }

  console.log('\n=== Signing with deposit wallet address in message ===')
  console.log('Message address:', messageWithProxy.address)

  const signature = await agentSigner.signTypedData({
    domain,
    types,
    primaryType: 'ClobAuth',
    message: messageWithProxy,
  })

  console.log('Signature:', signature.slice(0, 20) + '...')

  // Try creating API key with this signature
  const headers = {
    POLY_ADDRESS: PROXY, // Use deposit wallet address
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: ts.toString(),
    POLY_NONCE: nonce.toString(),
  }

  console.log('\n=== Trying POST /auth/api-key with deposit wallet address ===')
  const resp1 = await fetch('https://clob.polymarket.com/auth/api-key', {
    method: 'POST',
    headers,
  })
  console.log('Status:', resp1.status)
  const body1 = await resp1.text()
  console.log('Response:', body1.slice(0, 500))

  // Try derive endpoint
  console.log('\n=== Trying GET /auth/derive-api-key with deposit wallet address ===')
  const resp2 = await fetch('https://clob.polymarket.com/auth/derive-api-key', {
    method: 'GET',
    headers,
  })
  console.log('Status:', resp2.status)
  const body2 = await resp2.text()
  console.log('Response:', body2.slice(0, 500))

  // Also try with EOA address in POLY_ADDRESS but deposit wallet in message
  console.log('\n=== Trying POST /auth/api-key with EOA in POLY_ADDRESS, deposit in message ===')
  const headers2 = {
    POLY_ADDRESS: EOA,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: ts.toString(),
    POLY_NONCE: nonce.toString(),
  }
  const resp3 = await fetch('https://clob.polymarket.com/auth/api-key', {
    method: 'POST',
    headers: headers2,
  })
  console.log('Status:', resp3.status)
  const body3 = await resp3.text()
  console.log('Response:', body3.slice(0, 500))
}

main().catch(console.error)
