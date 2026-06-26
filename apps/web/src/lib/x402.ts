/**
 * The x402 tollbooth — server-side payment verification for the macro-alpha feed.
 *
 * A consumer that hits the feed without a valid `X-402-Payment-Receipt` header
 * gets HTTP 402 + payment terms. It pays the sub-cent USDC toll to the Stoa
 * Treasury on Arc, then retries with the tx hash in the header. We verify the
 * tx settled on Arc, paid >= the toll to the Treasury, and hasn't been used
 * before (replay protection via the payment_receipts table).
 *
 * Verification supports BOTH a native-USDC value transfer (Arc denominates gas
 * in USDC) and an ERC-20 USDC Transfer to the Treasury — whichever the payer
 * used. App Kit / Circle Nanopayments can layer on top later; this raw-receipt
 * path is the always-works fallback the plan calls for.
 *
 * Server-only.
 */
import { createPublicClient, http, parseUnits, getAddress } from "viem"
import { createClient } from "@supabase/supabase-js"

const ARC_RPC = process.env.ARC_RPC_URL || process.env.NEXT_PUBLIC_ARC_RPC || ""
const TREASURY = (process.env.STOA_TREASURY_ADDRESS ||
  process.env.NEXT_PUBLIC_STOA_TREASURY_ADDRESS ||
  "") as string
// The Arc USDC ERC-20 contract. When set, only Transfer events from this token
// count toward the toll — an arbitrary token sent to the Treasury won't pass.
const ARC_USDC = (process.env.ARC_USDC_ADDRESS ||
  process.env.NEXT_PUBLIC_ARC_USDC ||
  "") as string
const TOLL_USDC = process.env.X402_TOLL_USDC || "0.005"
const USDC_DECIMALS = Number(process.env.X402_USDC_DECIMALS || "6")
const RESOURCE = "/api/v1/feeds/macro-alpha"

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const ARC_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const

export interface PaymentTerms {
  scheme: "BatchEvmScheme"
  network: "arc-testnet"
  asset: "USDC"
  amount: string
  pay_to: string
  resource: string
  description: string
}

export function paymentTerms(): PaymentTerms {
  return {
    scheme: "BatchEvmScheme",
    network: "arc-testnet",
    asset: "USDC",
    amount: TOLL_USDC,
    pay_to: TREASURY,
    resource: RESOURCE,
    description: `Pay ${TOLL_USDC} USDC to unlock the Stoa macro-alpha feed.`,
  }
}

export interface VerifyResult {
  ok: boolean
  reason?: string
  payer?: string
  amountUsdc?: number
}

function topicToAddress(topic: string): string {
  // Address is the low 20 bytes of a 32-byte topic.
  return getAddress(`0x${topic.slice(-40)}`)
}

export async function verifyAndConsumeReceipt(txHash: string): Promise<VerifyResult> {
  if (!ARC_RPC) return { ok: false, reason: "arc-rpc-not-configured" }
  if (!TREASURY) return { ok: false, reason: "treasury-not-configured" }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return { ok: false, reason: "invalid-tx-hash" }
  if (!supabaseUrl || !supabaseKey) return { ok: false, reason: "supabase-not-configured" }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Replay protection: reject a receipt we've already honored.
  const { data: existing } = await supabase
    .from("payment_receipts")
    .select("tx_hash")
    .eq("tx_hash", txHash.toLowerCase())
    .maybeSingle()
  if (existing) return { ok: false, reason: "receipt-already-used" }

  const client = createPublicClient({ chain: ARC_CHAIN, transport: http(ARC_RPC) })

  let receipt
  let tx
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
    tx = await client.getTransaction({ hash: txHash as `0x${string}` })
  } catch {
    return { ok: false, reason: "tx-not-found-on-arc" }
  }
  if (receipt.status !== "success") return { ok: false, reason: "tx-not-settled" }

  const toll = parseUnits(TOLL_USDC, USDC_DECIMALS)
  const treasury = getAddress(TREASURY)

  // Path A: native-USDC value transfer straight to the Treasury.
  let paid = 0n
  if (tx.to && getAddress(tx.to) === treasury && tx.value >= toll) {
    paid = tx.value
  }

  // Path B: ERC-20 USDC Transfer(...) to the Treasury in the logs. When the USDC
  // contract is configured, only transfers of that token count.
  if (paid < toll) {
    const usdc = ARC_USDC ? getAddress(ARC_USDC) : null
    for (const log of receipt.logs) {
      if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
      if (usdc && getAddress(log.address) !== usdc) continue
      if (!log.topics[2]) continue
      if (topicToAddress(log.topics[2]) !== treasury) continue
      const amount = BigInt(log.data)
      if (amount > paid) paid = amount
    }
  }

  if (paid < toll) return { ok: false, reason: "underpaid-or-wrong-recipient" }

  const amountUsdc = Number(paid) / 10 ** USDC_DECIMALS
  await supabase.from("payment_receipts").insert({
    tx_hash: txHash.toLowerCase(),
    payer: tx.from ?? null,
    amount_usdc: amountUsdc,
    resource: RESOURCE,
  })

  return { ok: true, payer: tx.from, amountUsdc }
}
