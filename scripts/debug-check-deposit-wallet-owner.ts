import { createWalletClient, http, parseAbi } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const key = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as `0x${string}`
  const account = privateKeyToAccount(key)
  const client = createWalletClient({ account, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const FACTORY = '0x00000000000Fb5C9ADea0298D729A0CB3823Cc07'

  // Check if proxy has code
  const code = await client.request({ method: 'eth_getCode', params: [PROXY, 'latest'] })
  console.log('Proxy code length:', (code as string).length)
  console.log('Is deployed:', (code as string) !== '0x' && (code as string).length > 2)

  // Try to call owner() on the proxy
  // ERC-1967 proxy delegates to implementation, so we need to check the implementation
  // Storage slot for ERC-1967 implementation: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
  const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as `0x${string}`
  const impl = await client.request({ method: 'eth_getStorageAt', params: [PROXY, implSlot, 'latest'] })
  console.log('Implementation address:', impl)

  // Try calling owner() directly on the proxy
  try {
    const ownerResult = await client.request({
      method: 'eth_call',
      params: [{
        to: PROXY,
        data: '0x8da5cb5b' // owner() selector
      }, 'latest']
    })
    console.log('owner() result:', ownerResult)
    if (ownerResult && ownerResult !== '0x') {
      // Decode address from bytes32
      const ownerAddr = '0x' + (ownerResult as string).slice(26)
      console.log('Owner address:', ownerAddr)
    }
  } catch (e: any) {
    console.log('owner() call failed:', e.message)
  }

  // Try calling eoa() on the proxy
  try {
    const eoaResult = await client.request({
      method: 'eth_call',
      params: [{
        to: PROXY,
        data: '0x94bf8c80' // eoa() selector - might not exist
      }, 'latest']
    })
    console.log('eoa() result:', eoaResult)
  } catch (e: any) {
    console.log('eoa() call failed:', e.message)
  }

  // Check the factory for wallet owner mapping
  // The factory likely has a mapping: walletId => depositWallet address
  // And the walletId is bytes32(owner address)
  // Let's check if our addresses are the owners

  const agentEOA = '0x5b92F8A222704d522Fb3dCf8d734C3DAF51Fc4f1'
  const signingEOA = '0x3F60d48E5499C7560C72DfEEfC62fF5052e7e4C2'

  // Check deposit wallets for both EOAs via the relayer
  console.log('\n=== Checking deposit wallets via relayer ===')

  // The relayer URL - need to find it
  // Let's check common Polymarket relayer URLs
  const relayerUrls = [
    'https://relayer.polymarket.com',
    'https://relayer.lb.polymarket.com',
  ]

  for (const relayerUrl of relayerUrls) {
    try {
      const resp = await fetch(`${relayerUrl}/wallet?address=${agentEOA}`)
      console.log(`Agent EOA wallet (${relayerUrl}):`, resp.status, await resp.text().then(t => t.slice(0, 200)))
    } catch (e: any) {
      console.log(`Agent EOA wallet (${relayerUrl}): error -`, e.message)
    }

    try {
      const resp = await fetch(`${relayerUrl}/wallet?address=${signingEOA}`)
      console.log(`Signing EOA wallet (${relayerUrl}):`, resp.status, await resp.text().then(t => t.slice(0, 200)))
    } catch (e: any) {
      console.log(`Signing EOA wallet (${relayerUrl}): error -`, e.message)
    }
  }

  // Also check the DepositWalletFactory for wallet mapping
  // The factory likely has: getWallet(bytes32 walletId) => address
  // walletId = keccak256(abi.encodePacked(owner))
  console.log('\n=== Checking factory wallet mapping ===')

  // Try calling getWallet on the factory
  for (const eoa of [agentEOA, signingEOA]) {
    // walletId = bytes32(owner) - the owner address padded to 32 bytes
    const walletId = '0x' + eoa.slice(2).toLowerCase().padStart(64, '0')
    try {
      const result = await client.request({
        method: 'eth_call',
        params: [{
          to: FACTORY,
          data: '0x' + 'abcdef01' + walletId.slice(2), // guess the selector
        }, 'latest']
      })
      console.log(`Factory wallet for ${eoa}:`, result)
    } catch (e: any) {
      console.log(`Factory wallet for ${eoa}: error -`, e.message)
    }
  }
}

main().catch(console.error)
