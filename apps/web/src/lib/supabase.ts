import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

// --- Types matching the Supabase schema ---

export interface AgentRow {
  agent_id: string
  owner_address: string
  registered_at: string
  display_handle: string | null
  framework: string | null
  polymarket_builder_code: string | null
}

export interface TraceRow {
  trace_hash: string
  agent_id: string
  market_id: string
  rating: number
  confidence_bps: number
  irys_receipt: string
  arc_tx_hash: string
  block_number: number
  published_at: string
  venue: string | null
  /** Persona classification of the trace's reasoning style. Written by the
   *  classifier (async after publish) or backfill script. Null until landed. */
  classified_persona: string | null
  classification_confidence_bps: number | null
  classification_rationale: string | null
  classified_at: string | null
}

export interface FillRow {
  fill_id: string
  agent_id: string
  trace_hash: string
  market_id: string
  taker_address: string
  notional_usdc: number
  builder_fee_usdc: number
  filled_at: string
}

// --- Query helpers ---

export async function getAgents(): Promise<AgentRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('registered_at', { ascending: false })
  if (error) {
    console.error('[supabase] getAgents:', error.message)
    return []
  }
  return data ?? []
}

export async function getTraces(): Promise<TraceRow[]> {
  if (!supabase) return []
  // Supabase REST defaults to a 1000-row ceiling. We're already at ~1000
  // and the daemon adds more every cycle, so raise the cap explicitly.
  // The trace stream paginates client-side, so returning everything is fine.
  const { data, error } = await supabase
    .from('traces')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(5000)
  if (error) {
    console.error('[supabase] getTraces:', error.message)
    return []
  }
  return data ?? []
}

export interface AgentWithTraceCount extends AgentRow {
  trace_count: number
  latest_trace_at: string | null
  /** Most-frequent classified persona across this agent's traces (mode).
   *  Null when the agent has no classified traces yet. */
  dominant_classified_persona: string | null
}

export async function getAgentsWithTraceCounts(): Promise<AgentWithTraceCount[]> {
  if (!supabase) return []

  // Get all agents
  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .order('registered_at', { ascending: false })

  if (agentError) {
    console.error('[supabase] getAgentsWithTraceCounts:', agentError.message)
    return []
  }
  if (!agents) return []

  // Get trace counts + classified personas per agent
  const { data: traces, error: traceError } = await supabase
    .from('traces')
    .select('agent_id, published_at, classified_persona')

  if (traceError) {
    console.error('[supabase] trace counts:', traceError.message)
    return agents.map(a => ({
      ...a,
      trace_count: 0,
      latest_trace_at: null,
      dominant_classified_persona: null,
    }))
  }

  // Aggregate per agent: total count, latest publish time, persona histogram.
  interface AgentStats {
    count: number
    latest: string
    personaCounts: Map<string, number>
  }
  const stats = new Map<string, AgentStats>()
  for (const t of traces ?? []) {
    const key = t.agent_id.toLowerCase()
    const entry = stats.get(key) ?? {
      count: 0,
      latest: '',
      personaCounts: new Map<string, number>(),
    }
    entry.count++
    if (t.published_at > entry.latest) entry.latest = t.published_at
    if (t.classified_persona) {
      const p = t.classified_persona.toLowerCase()
      entry.personaCounts.set(p, (entry.personaCounts.get(p) ?? 0) + 1)
    }
    stats.set(key, entry)
  }

  return agents
    .map(a => {
      const s = stats.get(a.agent_id.toLowerCase())
      let dominant: string | null = null
      if (s && s.personaCounts.size > 0) {
        let best = ''
        let bestCount = 0
        for (const [persona, count] of s.personaCounts) {
          if (count > bestCount) {
            best = persona
            bestCount = count
          }
        }
        dominant = best
      }
      return {
        ...a,
        trace_count: s?.count ?? 0,
        latest_trace_at: s?.latest || null,
        dominant_classified_persona: dominant,
      }
    })
    .sort((a, b) => b.trace_count - a.trace_count)
}

export async function getTracesByAgent(agentId: string): Promise<TraceRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('traces')
    .select('*')
    .eq('agent_id', agentId)
    .order('published_at', { ascending: false })
  if (error) {
    console.error('[supabase] getTracesByAgent:', error.message)
    return []
  }
  return data ?? []
}

export async function getFills(): Promise<FillRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('fills')
    .select('*')
    .order('filled_at', { ascending: false })
  if (error) {
    console.error('[supabase] getFills:', error.message)
    return []
  }
  return data ?? []
}

export async function getFillsByAgent(agentId: string): Promise<FillRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('fills')
    .select('*')
    .eq('agent_id', agentId)
    .order('filled_at', { ascending: false })
  if (error) {
    console.error('[supabase] getFillsByAgent:', error.message)
    return []
  }
  return data ?? []
}
