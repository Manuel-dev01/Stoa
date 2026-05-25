import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * GET /api/v1/agents
 *
 * Query params:
 *   persona — filter by the agent's dominant classified persona (mode of
 *             that agent's trace classifications). Reads from the new
 *             classified_persona column on traces, not from display_handle.
 *   limit (default 50, max 200), offset (default 0)
 *
 * Response shape unchanged: { agents: [...], total: number }. Each agent row
 * gains `trace_count` and `dominant_classified_persona` for downstream use.
 */
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { searchParams } = new URL(req.url)

  const persona = searchParams.get("persona")?.toLowerCase() || null
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200)
  const offset = Number(searchParams.get("offset") || "0")

  // Load all agents — we need to compute persona aggregation across all of
  // them before slicing, since filtering is on a derived field.
  const { data: agents, error: agentsErr } = await supabase
    .from("agents")
    .select("*")
    .order("registered_at", { ascending: false })

  if (agentsErr) {
    return NextResponse.json({ error: agentsErr.message }, { status: 500 })
  }

  // Pull every trace's (agent_id, classified_persona). Used to compute the
  // mode of classified personas per agent.
  const { data: traces } = await supabase
    .from("traces")
    .select("agent_id, classified_persona")

  interface Stats {
    count: number
    personaCounts: Map<string, number>
  }
  const stats = new Map<string, Stats>()
  for (const t of traces ?? []) {
    const key = t.agent_id.toLowerCase()
    const entry = stats.get(key) ?? { count: 0, personaCounts: new Map<string, number>() }
    entry.count++
    if (t.classified_persona) {
      const p = t.classified_persona.toLowerCase()
      entry.personaCounts.set(p, (entry.personaCounts.get(p) ?? 0) + 1)
    }
    stats.set(key, entry)
  }

  const enriched = (agents ?? []).map((a) => {
    const s = stats.get(a.agent_id.toLowerCase())
    let dominant: string | null = null
    if (s && s.personaCounts.size > 0) {
      let best = ""
      let bestCount = 0
      for (const [p, c] of s.personaCounts) {
        if (c > bestCount) {
          best = p
          bestCount = c
        }
      }
      dominant = best
    }
    return {
      ...a,
      trace_count: s?.count ?? 0,
      dominant_classified_persona: dominant,
    }
  })

  const filtered = persona
    ? enriched.filter((a) => a.dominant_classified_persona === persona)
    : enriched

  const paged = filtered.slice(offset, offset + limit)

  return NextResponse.json({ agents: paged, total: filtered.length })
}
