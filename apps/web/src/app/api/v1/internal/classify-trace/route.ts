/**
 * Internal endpoint: classify a single already-published trace.
 *
 * Used by the multi-agent daemon (scripts/multi-agent-daemon.py), which writes
 * traces directly to Supabase and bypasses /api/v1/traces. This endpoint gives
 * the daemon a way to trigger the same classification pass that /api/v1/traces
 * runs in its waitUntil hook.
 *
 * Fire-and-forget from the caller's perspective: this endpoint returns 202 as
 * soon as the classification is scheduled, and the actual work runs via
 * waitUntil so it survives the response. Failures are logged and ignored.
 *
 * Auth: requires INDEXER_AUTH_TOKEN in the Authorization header. Not exposed
 * to external callers; it's a back-channel between the daemon and the web app.
 */
import { NextRequest, NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { createClient } from "@supabase/supabase-js"
import { classifyTraceReasoning } from "@/lib/persona-classifier"

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const authToken = process.env.INDEXER_AUTH_TOKEN

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  // Token auth — keeps random callers from running our DeepSeek bill up.
  if (authToken) {
    const got = req.headers.get("authorization") || ""
    const expected = `Bearer ${authToken}`
    if (got !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({})) as { traceHash?: string }
  const traceHash = (body.traceHash || "").toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(traceHash)) {
    return NextResponse.json({ error: "invalid traceHash" }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Look up the irys receipt so we can fetch the reasoning text. Also skip if
  // this trace is already classified — keeps the daemon's fire-and-forget
  // calls idempotent.
  const { data: row, error } = await supabase
    .from("traces")
    .select("irys_receipt, classified_persona, agent_id")
    .eq("trace_hash", traceHash)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: "trace not found" }, { status: 404 })
  }
  if (row.classified_persona) {
    return NextResponse.json({ status: "already_classified", persona: row.classified_persona })
  }
  if (!row.irys_receipt) {
    return NextResponse.json({ error: "trace has no irys_receipt" }, { status: 400 })
  }

  // The agent's legacy display_handle is the persona its owner prompted the
  // inference under. Pass it to the classifier as a soft prior so daemon
  // traces that came out style-ambiguous fall back to the intended persona
  // instead of all collapsing into stoikos.
  let hint: string | undefined
  if (row.agent_id) {
    const { data: agent } = await supabase
      .from("agents")
      .select("display_handle")
      .eq("agent_id", row.agent_id)
      .single()
    hint = agent?.display_handle?.toLowerCase() || undefined
  }

  // Schedule the classification on the function's keep-alive promise. Respond
  // immediately so the daemon doesn't block.
  waitUntil(
    (async () => {
      try {
        const gateway = process.env.IRYS_GATEWAY_URL || "https://gateway.irys.xyz"
        const fetchBody = async (base: string) => {
          const resp = await fetch(`${base}/${row.irys_receipt}`, {
            signal: AbortSignal.timeout(15_000),
          })
          if (!resp.ok) throw new Error(`irys ${resp.status}`)
          return resp.json() as Promise<{
            reasoning?: { bull?: string; bear?: string; synthesis?: string }
          }>
        }

        let traceBody
        try {
          traceBody = await fetchBody(gateway)
        } catch {
          // Devnet uploads sit at devnet.irys.xyz, mainnet at gateway.irys.xyz.
          // The daemon currently uses devnet; fall back so we don't have to
          // care which one a given trace came from.
          traceBody = await fetchBody("https://devnet.irys.xyz")
        }

        if (!traceBody.reasoning) {
          console.error(`[classify-trace] ${traceHash}: irys body has no reasoning`)
          return
        }

        const result = await classifyTraceReasoning(traceBody.reasoning, hint)
        if (!result) {
          console.error(`[classify-trace] ${traceHash}: classifier returned null`)
          return
        }

        const { error: updateErr } = await supabase
          .from("traces")
          .update({
            classified_persona: result.persona,
            classification_confidence_bps: result.confidenceBps,
            classification_rationale: result.rationale,
            classified_at: new Date().toISOString(),
          })
          .eq("trace_hash", traceHash)

        if (updateErr) {
          console.error(`[classify-trace] ${traceHash}: supabase update failed:`, updateErr.message)
        } else {
          console.log(`[classify-trace] ${traceHash}: classified as ${result.persona} (${result.confidenceBps}bps)`)
        }
      } catch (err) {
        console.error(
          `[classify-trace] ${traceHash}: background failed:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    })(),
  )

  return NextResponse.json({ status: "scheduled" }, { status: 202 })
}
