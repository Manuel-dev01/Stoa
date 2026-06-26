import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * GET /api/v1/agents
 *
 * Lists the registered Triad agents (quantec | bayesian | calibrator),
 * each enriched with its lifetime `trace_count`.
 *
 * Query params:
 *   limit (default 50, max 200), offset (default 0)
 *
 * Response shape: { agents: [...], total: number }.
 */
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { searchParams } = new URL(req.url)

  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200)
  const offset = Number(searchParams.get("offset") || "0")

  const { data: agents, error: agentsErr } = await supabase
    .from("agents")
    .select("*")
    .order("registered_at", { ascending: false })

  if (agentsErr) {
    return NextResponse.json({ error: agentsErr.message }, { status: 500 })
  }

  // Per-agent trace counts.
  const { data: traces } = await supabase.from("traces").select("agent_id")
  const counts = new Map<string, number>()
  for (const t of traces ?? []) {
    const key = t.agent_id.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const enriched = (agents ?? []).map((a) => ({
    ...a,
    trace_count: counts.get(a.agent_id.toLowerCase()) ?? 0,
  }))

  const paged = enriched.slice(offset, offset + limit)

  return NextResponse.json({ agents: paged, total: enriched.length })
}
