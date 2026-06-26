import { NextRequest, NextResponse } from "next/server"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { createClient } from "@supabase/supabase-js"
import { TRIAD_KEYS, getTriadLabel } from "@stoa-agents/shared"

// Arc testnet chain config
const ARC_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC || ""] } },
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
} as const

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_STOA_REGISTRY_ADDRESS as `0x${string}`
const SIGNER_KEY = process.env.INDEXER_SIGNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// registerAgent ABI
const registerAgentAbi = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [],
    outputs: [{ name: "agentId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const

// AgentRegistered event ABI
const agentRegisteredAbi = [
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const

/**
 * POST /api/v1/agents/register
 *
 * Registers a new agent on StoaRegistry. The server-side signer pays gas.
 * In the Triad model the only registered agents are Stoa's three engines
 * (quantec | bayesian | calibrator); `agent` sets the display handle.
 *
 * Body:
 *   ownerAddress?: string (defaults to signer address)
 *   agent?: string (one of TRIAD_KEYS, defaults to "calibrator")
 */
export async function POST(req: NextRequest) {
  try {
    if (!SIGNER_KEY) {
      return NextResponse.json({ error: "Server signer not configured" }, { status: 500 })
    }
    if (!REGISTRY_ADDRESS) {
      return NextResponse.json({ error: "Registry address not configured" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const agentKey = (body.agent || "calibrator").toLowerCase()

    if (!TRIAD_KEYS.includes(agentKey)) {
      return NextResponse.json(
        { error: `Invalid agent. Must be one of: ${TRIAD_KEYS.join(", ")}` },
        { status: 400 }
      )
    }

    const account = privateKeyToAccount(SIGNER_KEY as `0x${string}`)
    const walletClient = createWalletClient({
      account,
      chain: ARC_CHAIN,
      transport: http(),
    })

    // Send registerAgent tx
    const txHash = await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: registerAgentAbi,
      functionName: "registerAgent",
    })

    // Get agentId from tx receipt
    const publicClient = await import("viem").then((v) =>
      v.createPublicClient({ transport: http(ARC_CHAIN.rpcUrls.default.http[0]) })
    )
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    let agentId: string | null = null
    for (const log of receipt.logs) {
      try {
        const decoded = await import("viem").then((v) =>
          v.decodeEventLog({
            abi: agentRegisteredAbi,
            data: log.data,
            topics: log.topics,
          })
        )
        if (decoded.eventName === "AgentRegistered") {
          agentId = decoded.args.agentId as string
          break
        }
      } catch {
        // Not this event, skip
      }
    }

    if (!agentId) {
      return NextResponse.json(
        { error: "Could not extract agentId from tx receipt", txHash },
        { status: 500 }
      )
    }

    // Write to Supabase
    const displayHandle = getTriadLabel(agentKey)
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const row: Record<string, string> = {
        agent_id: agentId,
        owner_address: body.ownerAddress || account.address,
        display_handle: displayHandle,
      }
      await supabase.from("agents").upsert(row, {
        onConflict: "agent_id",
        ignoreDuplicates: false,
      })
    }

    return NextResponse.json({
      agentId,
      txHash,
      agent: displayHandle,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    console.error("[api/v1/agents/register] POST error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
