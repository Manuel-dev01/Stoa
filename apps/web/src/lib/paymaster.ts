/**
 * Circle Paymaster v0.8 integration for Arc testnet.
 *
 * Gas is paid in USDC via EIP-2612 permit signed by the user's smart account.
 * The paymaster withdraws USDC from the user's account to cover gas fees.
 *
 * Requires:
 * - NEXT_PUBLIC_BUNDLER_RPC — ERC-4337 bundler endpoint for Arc testnet
 * - NEXT_PUBLIC_ARC_USDC — USDC address on Arc testnet
 */

import { createPublicClient, http, encodePacked, maxUint256, getContract, erc20Abi, type Hex } from 'viem'
import { toSimple7702SmartAccount, createBundlerClient } from 'viem/account-abstraction'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

const ARC_CHAIN = {
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC || ''] } },
  testnet: true,
} as const

const PAYMASTER_V08_ADDRESS = '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966' as const

const EIP2612_ABI = [
  ...erc20Abi,
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export async function createGasFreeAccount(privateKey: string) {
  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  const owner = privateKeyToAccount(key as Hex)
  const client = createPublicClient({ chain: ARC_CHAIN, transport: http(ARC_CHAIN.rpcUrls.default.http[0]) })
  const account = await toSimple7702SmartAccount({ client, owner })
  return { account, client, owner }
}

export async function signPermit(params: {
  tokenAddress: Hex
  account: Awaited<ReturnType<typeof toSimple7702SmartAccount>>
  client: ReturnType<typeof createPublicClient>
  spenderAddress: Hex
  permitAmount: bigint
}): Promise<Hex> {
  const { tokenAddress, account, client, spenderAddress, permitAmount } = params

  const token = getContract({
    client,
    address: tokenAddress,
    abi: EIP2612_ABI,
  })

  const [name, version, nonce] = await Promise.all([
    token.read.name(),
    token.read.version(),
    token.read.nonces([account.address]),
  ])

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
      name: name as string,
      version: version as string,
      chainId: client.chain!.id,
      verifyingContract: tokenAddress,
    },
    message: {
      owner: account.address,
      spender: spenderAddress,
      value: permitAmount.toString(),
      nonce: nonce.toString(),
      deadline: maxUint256.toString(),
    },
  } as const

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signature = await account.signTypedData(permitData as any)
  return signature
}

export function createPaymaster(usdcAddress: Hex, accountRef: { account: Awaited<ReturnType<typeof toSimple7702SmartAccount>>, client: ReturnType<typeof createPublicClient> }) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getPaymasterData(_parameters: any) {
      const permitAmount = 10_000_000n // 10 USDC allowance for gas
      const permitSignature = await signPermit({
        tokenAddress: usdcAddress,
        account: accountRef.account,
        client: accountRef.client,
        spenderAddress: PAYMASTER_V08_ADDRESS,
        permitAmount,
      })

      const paymasterData = encodePacked(
        ['uint8', 'address', 'uint256', 'bytes'],
        [0, usdcAddress, permitAmount, permitSignature],
      )

      return {
        paymaster: PAYMASTER_V08_ADDRESS,
        paymasterData,
        paymasterVerificationGasLimit: 200000n,
        paymasterPostOpGasLimit: 15000n,
        isFinal: true,
      }
    },
  }
}

export async function createGasFreeClient(params: {
  privateKey: string
  bundlerRpc: string
  usdcAddress: Hex
}) {
  const { account, client, owner } = await createGasFreeAccount(params.privateKey)
  const paymaster = createPaymaster(params.usdcAddress, { account, client })

  const bundlerClient = createBundlerClient({
    account,
    client,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymaster: paymaster as any,
    transport: http(params.bundlerRpc),
  })

  return { bundlerClient, account, client, owner }
}
