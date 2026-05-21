import { createWalletClient, http, type Hex, decodeEventLog } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as Hex
  const agentAccount = privateKeyToAccount(agentKey)
  const client = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'
  const FACTORY = '0x00000000000Fb5C9ADea0298D729A0CB3823Cc07'

  // Check proxy code
  const code = await client.request({ method: 'eth_getCode', params: [PROXY, 'latest'] })
  console.log('Proxy deployed:', (code as string).length > 2)

  // Check implementation slot
  const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as `0x${string}`
  const impl = await client.request({ method: 'eth_getStorageAt', params: [PROXY, implSlot, 'latest'] })
  console.log('Implementation:', impl)

  // Try to find the WalletCreated event from the factory
  // The factory likely emits events when wallets are created
  // Let's check recent blocks for WalletCreated events

  // Get latest block
  const latestBlock = await client.request({ method: 'eth_blockNumber', params: [] })
  console.log('Latest block:', latestBlock)

  // Search for events from the factory in a range of blocks
  // WalletCreated(address indexed owner, address indexed wallet)
  // Event signature: keccak256("WalletCreated(address,address)")
  const walletCreatedTopic = '0x' // We don't know the exact event signature

  // Instead, let's try to call the factory's walletOf or getWallet method
  // Common function signatures:
  // walletOf(bytes32) => address
  // getWallet(bytes32) => address
  // wallets(bytes32) => address

  const agentEOA = '0x5b92F8A222704d522Fb3dCf8d734C3DAF51Fc4f1'
  const signingEOA = '0x3F60d48E5499C7560C72DfEEfC62fF5052e7e4C2'

  // walletId = bytes32(owner) - owner address padded to 32 bytes
  const agentWalletId = '0x' + agentEOA.slice(2).toLowerCase().padStart(64, '0')
  const signingWalletId = '0x' + signingEOA.slice(2).toLowerCase().padStart(64, '0')

  // Try different function selectors
  // keccak256("walletOf(bytes32)") = ?
  // keccak256("getWallet(bytes32)") = ?
  // keccak256("wallets(bytes32)") = ?

  const selectors = [
    { name: 'walletOf(bytes32)', selector: '0x' + 'walletOf(bytes32)'.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').slice(0, 8) },
    { name: 'getWallet(bytes32)', selector: '0x' + 'getWallet(bytes32)'.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').slice(0, 8) },
  ]

  // Actually, let me compute the selectors properly using keccak256
  // For now, let me just try calling with different selectors

  // Common selectors for deposit wallet factory:
  // 0x3b873517 = walletOf(bytes32)
  // 0x2d55b12b = getWallet(bytes32)

  const testSelectors = ['0x3b873517', '0x2d55b12b']

  for (const sel of testSelectors) {
    for (const [name, walletId] of [['agent', agentWalletId], ['signing', signingWalletId]]) {
      try {
        const result = await client.request({
          method: 'eth_call',
          params: [{ to: FACTORY, data: sel + walletId.slice(2) }, 'latest'],
        })
        console.log(`Factory ${sel} for ${name}: ${result}`)
        if (result && result !== '0x' && result !== '0x' + '0'.repeat(64)) {
          const addr = '0x' + (result as string).slice(26)
          console.log(`  -> Address: ${addr}`)
          console.log(`  -> Matches PROXY: ${addr.toLowerCase() === PROXY.toLowerCase()}`)
        }
      } catch (e: any) {
        // ignore
      }
    }
  }

  // Also try the relayer API to check wallet status
  console.log('\n=== Relayer API checks ===')

  // The Polymarket relayer URL
  const relayerUrl = 'https://relayer.polymarket.com'

  for (const [name, addr] of [['agent', agentEOA], ['signing', signingEOA]]) {
    try {
      const resp = await fetch(`${relayerUrl}/wallet?address=${addr}`)
      const text = await resp.text()
      console.log(`${name} wallet (${resp.status}):`, text.slice(0, 300))
    } catch (e: any) {
      console.log(`${name} wallet error:`, e.message)
    }
  }
}

main().catch(console.error)
