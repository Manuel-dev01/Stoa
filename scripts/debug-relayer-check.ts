import { createWalletClient, http, type Hex, keccak256, encodePacked, getCreate2Address } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const agentKey = '0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40' as Hex
  const agentAccount = privateKeyToAccount(agentKey)

  const signingKey = (process.env.POLYMARKET_PRIVATE_KEY!.startsWith('0x')
    ? process.env.POLYMARKET_PRIVATE_KEY
    : `0x${process.env.POLYMARKET_PRIVATE_KEY}`) as Hex
  const signingAccount = privateKeyToAccount(signingKey)

  const FACTORY = '0x00000000000Fb5C9ADea0298D729A0CB3823Cc07'
  const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a'

  console.log('Agent EOA:', agentAccount.address)
  console.log('Signing EOA:', signingAccount.address)
  console.log('Expected deposit wallet:', PROXY)

  // Try to derive the deposit wallet address using CREATE2
  // The factory uses: walletId = bytes32(owner), salt = keccak256(abi.encode(factory, walletId))
  // bytecodeHash = SoladyLibClone.initCodeHashERC1967(implementation, args)
  // depositWallet = CREATE2(factory, salt, bytecodeHash)

  // We don't know the exact implementation address or bytecode hash,
  // but we can try to find it by checking the factory's storage

  const client = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })

  // Check factory's implementation slot
  // The factory likely stores the implementation address somewhere
  // Let's check common storage slots

  for (let slot = 0; slot < 10; slot++) {
    const slotHex = '0x' + slot.toString(16).padStart(64, '0') as `0x${string}`
    const value = await client.request({
      method: 'eth_getStorageAt',
      params: [FACTORY, slotHex, 'latest'],
    })
    if (value !== '0x' + '0'.repeat(64)) {
      console.log(`Factory slot ${slot}: ${value}`)
    }
  }

  // Try to derive deposit wallet for both EOAs using different approaches
  // Approach 1: walletId = bytes32(owner address)
  for (const [name, addr] of [['agent', agentAccount.address], ['signing', signingAccount.address]]) {
    const walletId = keccak256(addr.toLowerCase() as `0x${string}`)
    console.log(`\n${name} walletId (keccak256): ${walletId}`)

    // Try CREATE2 with factory as deployer
    // We need the bytecodeHash of the clone
    // For ERC-1967 clones, the init code hash is specific to the factory
  }

  // Let's try a different approach: check if the Polymarket UI shows a deposit wallet
  // by looking at the CLOB API's balance endpoint with different signature types

  console.log('\n=== Checking CLOB balances for both wallets ===')

  const { ClobClient, Chain, SignatureTypeV2, AssetType } = await import('@polymarket/clob-client-v2')

  // Agent wallet with deposit wallet
  const agentSigner = createWalletClient({ account: agentAccount, transport: http('https://polygon-bor-rpc.publicnode.com') })
  const agentCreds = {
    key: '7a658867-2edc-cc92-7c35-9f36475cda38',
    secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
    passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
  }

  // Check EOA balance (sigType=0)
  const eoaClient = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: agentSigner,
    creds: agentCreds,
  })
  try {
    const eoaBal = await eoaClient.getBalanceAllowance({ asset_type: AssetType.COLLATERAL })
    console.log('Agent EOA balance:', JSON.stringify(eoaBal))
  } catch (e: any) {
    console.log('Agent EOA balance error:', e.message)
  }

  // Check deposit wallet balance (sigType=3)
  const depositClient = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: agentSigner,
    creds: agentCreds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: PROXY,
  })
  try {
    const depositBal = await depositClient.getBalanceAllowance({ asset_type: AssetType.COLLATERAL })
    console.log('Agent deposit wallet balance:', JSON.stringify(depositBal))
  } catch (e: any) {
    console.log('Agent deposit wallet balance error:', e.message)
  }

  // Check with NO funder address but POLY_1271
  const noFunderClient = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: Chain.POLYGON,
    signer: agentSigner,
    creds: agentCreds,
    signatureType: SignatureTypeV2.POLY_1271,
  })
  try {
    const noFunderBal = await noFunderClient.getBalanceAllowance({ asset_type: AssetType.COLLATERAL })
    console.log('Agent POLY_1271 no funder balance:', JSON.stringify(noFunderBal))
  } catch (e: any) {
    console.log('Agent POLY_1271 no funder error:', e.message)
  }
}

main().catch(console.error)
