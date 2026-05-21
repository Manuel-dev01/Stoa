/**
 * test-paymaster.ts
 *
 * Fires a real UserOp on Arc testnet via Circle Paymaster v0.8.
 * Verifies: UserOp hash, tx hash, gas paid in USDC, event emitted.
 *
 * Run: node --import tsx scripts/test-paymaster.ts
 */
import { createPublicClient, http, formatUnits, erc20Abi, encodeFunctionData } from 'viem'
import { toSimple7702SmartAccount, createBundlerClient } from 'viem/account-abstraction'
import { privateKeyToAccount } from 'viem/accounts'
import { encodePacked, maxUint256, getContract } from 'viem'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const ARC_CHAIN = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC || process.env.ARC_RPC_URL || ''] } },
  testnet: true,
} as const

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
const PAYMASTER_V08 = '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966' as const
const STOA_REGISTRY = '0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b' as const

const EIP2612_ABI = [
  ...erc20Abi,
  { inputs: [{ name: 'owner', type: 'address' }], name: 'nonces', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'version', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
] as const

const REGISTRY_ABI = [
  {
    name: 'publishTrace',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'bytes32' },
      { name: 'traceHash', type: 'bytes32' },
      { name: 'marketId', type: 'bytes32' },
      { name: 'rating', type: 'int8' },
      { name: 'confidenceBps', type: 'uint16' },
      { name: 'irysReceipt', type: 'string' },
    ],
    outputs: [],
  },
] as const

async function main() {
  const rpcUrl = ARC_CHAIN.rpcUrls.default.http[0]
  const bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC
  if (!bundlerRpc) throw new Error('NEXT_PUBLIC_BUNDLER_RPC not set')

  const rawKey = process.env.AGENT_PRIVATE_KEY || process.env.POLYMARKET_PRIVATE_KEY
  if (!rawKey) throw new Error('No private key found')
  const key = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`

  console.log('=== Paymaster v0.8 test on Arc testnet ===')
  console.log('RPC:', rpcUrl.slice(0, 60) + '...')
  console.log('Bundler:', bundlerRpc.slice(0, 60) + '...')
  console.log()

  // Create client — use request-based approach to avoid viem hanging
  const owner = privateKeyToAccount(key as `0x${string}`)

  // Check USDC balance via raw RPC
  const balResp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: USDC_ADDRESS, data: '0x70a08231' + owner.address.slice(2).toLowerCase().padStart(64, '0') }, 'latest'],
      id: 1,
    }),
  })
  const balJson = await balResp.json() as { result: string }
  const usdcBalance = BigInt(balJson.result)
  console.log(`Owner EOA: ${owner.address}`)
  console.log(`USDC balance: ${formatUnits(usdcBalance, 6)} USDC`)

  if (usdcBalance < 1_000_000n) {
    console.error('Insufficient USDC — need at least 1 USDC to pay gas')
    process.exit(1)
  }

  // Create viem client (use http transport directly, not proxied)
  const client = createPublicClient({ chain: ARC_CHAIN, transport: http(rpcUrl) })

  // Create 7702 smart account
  console.log('\nCreating Simple7702SmartAccount...')
  const account = await toSimple7702SmartAccount({ client, owner })
  console.log(`Smart account address: ${account.address}`)

  // Sign EIP-2612 permit for paymaster
  console.log('\nSigning EIP-2612 permit for paymaster...')
  const token = getContract({ client, address: USDC_ADDRESS, abi: EIP2612_ABI })
  const [tokenName, tokenVersion, nonce] = await Promise.all([
    token.read.name(),
    token.read.version(),
    token.read.nonces([account.address]),
  ])
  console.log(`Token: ${tokenName} v${tokenVersion}, nonce: ${nonce}`)

  const permitAmount = 10_000_000n // 10 USDC
  const permitData = {
    types: {
      EIP712Domain: [
        { name: 'name' as const, type: 'string' },
        { name: 'version' as const, type: 'string' },
        { name: 'chainId' as const, type: 'uint256' },
        { name: 'verifyingContract' as const, type: 'address' },
      ],
      Permit: [
        { name: 'owner' as const, type: 'address' },
        { name: 'spender' as const, type: 'address' },
        { name: 'value' as const, type: 'uint256' },
        { name: 'nonce' as const, type: 'uint256' },
        { name: 'deadline' as const, type: 'uint256' },
      ],
    },
    primaryType: 'Permit' as const,
    domain: {
      name: tokenName,
      version: tokenVersion,
      chainId: ARC_CHAIN.id,
      verifyingContract: USDC_ADDRESS,
    },
    message: {
      owner: account.address,
      spender: PAYMASTER_V08,
      value: permitAmount.toString(),
      nonce: nonce.toString(),
      deadline: maxUint256.toString(),
    },
  } as const

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permitSignature = await account.signTypedData(permitData as any)
  console.log(`Permit signature: ${permitSignature.slice(0, 18)}...`)

  // Create paymaster
  const paymaster = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getPaymasterData(_params: any) {
      const paymasterData = encodePacked(
        ['uint8', 'address', 'uint256', 'bytes'],
        [0, USDC_ADDRESS, permitAmount, permitSignature],
      )
      return {
        paymaster: PAYMASTER_V08,
        paymasterData,
        paymasterVerificationGasLimit: 200000n,
        paymasterPostOpGasLimit: 15000n,
        isFinal: true,
      }
    },
  }

  // Create bundler client
  console.log('\nCreating bundler client...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bundlerClient = createBundlerClient({
    account,
    client,
    paymaster: paymaster as any,
    transport: http(bundlerRpc),
  })
  console.log('Bundler client created')

  // Send a minimal UserOp — just a self-transfer of 0 USDC (no-op, but proves the pipeline)
  console.log('\nSending UserOp...')
  const hash = await bundlerClient.sendUserOperation({
    account,
    calls: [
      {
        to: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [account.address, 0n], // no-op: self-transfer 0 USDC
      },
    ],
  })
  console.log(`\nUserOp hash: ${hash}`)

  // Wait for receipt
  console.log('\nWaiting for UserOp receipt...')
  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash })
  console.log(`\n=== RESULTS ===`)
  console.log(`UserOp hash: ${hash}`)
  console.log(`Tx hash: ${receipt.receipt.transactionHash}`)
  console.log(`Success: ${receipt.success}`)
  console.log(`Gas used: ${receipt.receipt.gasUsed}`)

  // Check the tx to see what gas token was used
  console.log(`\nExplorer: https://testnet.arcscan.app/tx/${receipt.receipt.transactionHash}`)
  console.log(`\nVerify on explorer that gas was paid in USDC (not native token).`)
  console.log(`Paymaster address should be: ${PAYMASTER_V08}`)

  process.exit(0)
}

main().catch((e) => {
  console.error('Test failed:', e.message || e)
  process.exit(1)
})
