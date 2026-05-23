import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * GET /api/v1/agents
 *
 * Query params: persona, limit (default 50), offset (default 0)
 */
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { searchParams } = new URL(req.url)

  const persona = searchParams.get("persona")
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200)
  const offset = Number(searchParams.get("offset") || "0")

  // Get agents
  let query = supabase
    .from("agents")
    .select("*", { count: "exact" })
    .order("registered_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (persona) query = query.ilike("display_handle", persona)

  const { data: agents, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get trace counts per agent
  const { data: traces } = await supabase
    .from("traces")
    .select("agent_id")

  const countMap = new Map<string, number>()
  for (const t of traces ?? []) {
    const key = t.agent_id.toLowerCase()
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const agentsWithCounts = (agents ?? []).map((a) => ({
    ...a,
    trace_count: countMap.get(a.agent_id.toLowerCase()) ?? 0,
  }))

  return NextResponse.json({ agents: agentsWithCounts, total: count ?? 0 })
}
