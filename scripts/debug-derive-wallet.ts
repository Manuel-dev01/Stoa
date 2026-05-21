import { createWalletClient, http, type Hex, keccak256, encodePacked, getCreate2Address, encodeAbiParameters } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as Hex
  const agentAccount = privateKeyToAccount(agentKey)

  const FACTORY = '0x00000000000Fb5C9ADea0298D729A0CB3823Cc07' as `0x${string}`
  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'

  // Implementation address from factory storage slot 0
  const IMPL = '0x58ca52ebe0dadfdf531cde7062e76746de4db1eb' as `0x${string}`

  console.log('Agent EOA:', agentAccount.address)
  console.log('Expected deposit wallet:', PROXY)
  console.log('Factory:', FACTORY)
  console.log('Implementation:', IMPL)

  // The factory uses Solady's LibClone for ERC-1967 clones
  // The derivation is:
  // walletId = bytes32(owner)
  // args = abi.encode(factory, walletId)
  // salt = keccak256(args)
  // bytecodeHash = keccak256(creationCode of ERC-1967 clone)
  // depositWallet = CREATE2(factory, salt, bytecodeHash)

  // Let's try different derivation approaches

  // Approach 1: Simple CREATE2 with owner as salt
  const owner = agentAccount.address

  // Try calling the factory's derive function
  // Common function: deriveWalletAddress(bytes32 walletId) returns (address)
  // Or: getWallet(bytes32 walletId) returns (address)

  const client = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  // Try different selectors for factory functions
  // Let's try to find the right one by checking what functions the factory has

  // Try: walletOf(bytes32)
  // selector = keccak256("walletOf(bytes32)")[:4]
  const selectors = [
    { name: 'walletOf(bytes32)', data: '0x3b873517' },
    { name: 'getWallet(bytes32)', data: '0x2d55b12b' },
    { name: 'deriveAddress(bytes32)', data: '0x' },
    { name: 'predictWalletAddress(address)', data: '0x' },
  ]

  // Actually, let me compute the selectors properly
  const fnSigs = [
    'walletOf(bytes32)',
    'getWallet(bytes32)',
    'wallets(bytes32)',
    'deriveWalletAddress(bytes32)',
    'predictWalletAddress(address)',
    'getDepositWallet(address)',
  ]

  for (const sig of fnSigs) {
    const selector = keccak256(sig).slice(0, 10)
    console.log(`\n${sig} => ${selector}`)

    // Try with walletId = keccak256(owner)
    const walletId = keccak256(owner.toLowerCase() as `0x${string}`)
    try {
      const result = await client.request({
        method: 'eth_call',
        params: [{ to: FACTORY, data: selector + walletId.slice(2) }, 'latest'],
      })
      if (result && result !== '0x' && result !== '0x' + '0'.repeat(64)) {
        const addr = '0x' + (result as string).slice(26)
        console.log(`  walletId(keccak256): ${addr} (matches PROXY: ${addr.toLowerCase() === PROXY.toLowerCase()})`)
      }
    } catch {}

    // Try with raw owner address as bytes32
    const ownerBytes32 = '0x' + owner.slice(2).toLowerCase().padStart(64, '0')
    try {
      const result = await client.request({
        method: 'eth_call',
        params: [{ to: FACTORY, data: selector + ownerBytes32.slice(2) }, 'latest'],
      })
      if (result && result !== '0x' && result !== '0x' + '0'.repeat(64)) {
        const addr = '0x' + (result as string).slice(26)
        console.log(`  ownerBytes32: ${addr} (matches PROXY: ${addr.toLowerCase() === PROXY.toLowerCase()})`)
      }
    } catch {}

    // Try with just owner address (for functions that take address type)
    try {
      const result = await client.request({
        method: 'eth_call',
        params: [{ to: FACTORY, data: selector + owner.slice(2).toLowerCase().padStart(64, '0') }, 'latest'],
      })
      if (result && result !== '0x' && result !== '0x' + '0'.repeat(64)) {
        const addr = '0x' + (result as string).slice(26)
        console.log(`  owner(address): ${addr} (matches PROXY: ${addr.toLowerCase() === PROXY.toLowerCase()})`)
      }
    } catch {}
  }

  // Also try: maybe the deposit wallet was created via Polymarket UI
  // and the CLOB has a different mapping
  // Let's check the CLOB's internal mapping by querying the relayer

  // The Polymarket relayer might have a different URL
  const relayerUrls = [
    'https://relayer.polymarket.com',
    'https://relayer-v2.polymarket.com',
    'https://relayer.api.polymarket.com',
  ]

  console.log('\n=== Checking relayer endpoints ===')
  for (const url of relayerUrls) {
    try {
      const resp = await fetch(`${url}/wallet?address=${owner}`, { signal: AbortSignal.timeout(5000) })
      console.log(`${url}/wallet: ${resp.status} ${await resp.text().then(t => t.slice(0, 200))}`)
    } catch (e: any) {
      console.log(`${url}/wallet: ${e.message}`)
    }
  }
}

main().catch(console.error)
