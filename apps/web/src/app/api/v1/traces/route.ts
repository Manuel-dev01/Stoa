import { NextRequest, NextResponse } from "next/server"
import { createWalletClient, http, keccak256, toHex, encodeFunctionData } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { createClient } from "@supabase/supabase-js"
import { uploadToIrys, canonicalizeJson } from "@/lib/irys"

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

// publishTrace ABI
const publishTraceAbi = [
  {
    type: "function",
    name: "publishTrace",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "marketId", type: "bytes32" },
      { name: "traceHash", type: "bytes32" },
      { name: "rating", type: "int8" },
      { name: "confidenceBps", type: "uint16" },
      { name: "irysReceipt", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

/**
 * POST /api/v1/traces
 *
 * Accepts a pre-built trace, uploads to Irys, hashes with Keccak256,
 * publishes to StoaRegistry on Arc, and writes to Supabase.
 *
 * Body:
 *   agentId: string (bytes32)
 *   marketId: string (bytes32)
 *   reasoning: { bull: string, bear: string, synthesis: string }
 *   decision: { rating: number, confidenceBps: number }
 *   venue?: string ("polymarket" | "kalshi")
 */
export async function POST(req: NextRequest) {
  try {
    if (!SIGNER_KEY) {
      return NextResponse.json({ error: "Server signer not configured" }, { status: 500 })
    }
    if (!REGISTRY_ADDRESS) {
      return NextResponse.json({ error: "Registry address not configured" }, { status: 500 })
    }

    const body = await req.json()
    const { agentId, marketId, reasoning, decision, venue } = body

    // Validate required fields
    if (!agentId || !marketId || !reasoning || !decision) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, marketId, reasoning, decision" },
        { status: 400 }
      )
    }
    if (typeof decision.rating !== "number" || decision.rating < -3 || decision.rating > 3) {
      return NextResponse.json({ error: "rating must be an integer between -3 and 3" }, { status: 400 })
    }
    if (typeof decision.confidenceBps !== "number" || decision.confidenceBps < 0 || decision.confidenceBps > 10000) {
      return NextResponse.json({ error: "confidenceBps must be 0-10000" }, { status: 400 })
    }

    // Build trace object
    const trace = {
      schemaVersion: "stoa.triad.v1",
      agentId,
      marketId,
      generatedAt: new Date().toISOString(),
      market: {
        question: body.marketQuestion || "",
        venue: venue || (marketId.toLowerCase().startsWith("kalshi:") ? "kalshi" : "polymarket"),
        resolutionAt: null,
      },
      reasoning: {
        bull: reasoning.bull || "",
        bear: reasoning.bear || "",
        synthesis: reasoning.synthesis || "",
      },
      decision: {
        rating: decision.rating,
        confidenceBps: decision.confidenceBps,
        kellyFraction: typeof decision.kellyFraction === "number" ? decision.kellyFraction : 0,
        sizeUsdc: decision.sizeUsdc || 0,
      },
      modelMetadata: {
        framework: body.framework || "external",
        quickThinkModel: body.model || "external",
        deepThinkModel: body.model || "external",
      },
    }

    // Upload to Irys
    const irysResult = await uploadToIrys(trace)
    const irysReceipt = irysResult.id

    // Hash with Keccak256 (matching Python agent)
    const canonical = canonicalizeJson(trace)
    const traceHash = keccak256(toHex(canonical))

    // Publish on-chain
    const account = privateKeyToAccount(SIGNER_KEY as `0x${string}`)
    const walletClient = createWalletClient({
      account,
      chain: ARC_CHAIN,
      transport: http(),
    })

    const txHash = await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: publishTraceAbi,
      functionName: "publishTrace",
      args: [
        agentId as `0x${string}`,
        marketId as `0x${string}`,
        traceHash,
        decision.rating,
        decision.confidenceBps,
        irysReceipt,
      ],
    })

    // Write to Supabase
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const resolvedVenue = venue || (marketId.toLowerCase().startsWith("kalshi:") ? "kalshi" : "polymarket")
      await supabase.from("traces").upsert(
        {
          trace_hash: traceHash,
          agent_id: agentId,
          market_id: marketId,
          rating: decision.rating,
          confidence_bps: decision.confidenceBps,
          irys_receipt: irysReceipt,
          arc_tx_hash: txHash,
          block_number: 0,
          published_at: new Date().toISOString(),
          venue: resolvedVenue,
        },
        { onConflict: "trace_hash", ignoreDuplicates: true }
      )
    }

    return NextResponse.json({
      traceHash,
      irysReceipt,
      arcTxHash: txHash,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    console.error("[api/v1/traces] POST error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/v1/traces
 *
 * Query params: agentId, venue, limit (default 50), offset (default 0)
 */
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { searchParams } = new URL(req.url)

  const agentId = searchParams.get("agentId")
  const venue = searchParams.get("venue")
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200)
  const offset = Number(searchParams.get("offset") || "0")

  let query = supabase
    .from("traces")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (agentId) query = query.eq("agent_id", agentId)
  if (venue) query = query.eq("venue", venue)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ traces: data ?? [], total: count ?? 0 })
}
