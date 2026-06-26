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

  // Get trace counts per agent
  const { data: traces, error: traceError } = await supabase
    .from('traces')
    .select('agent_id, published_at')

  if (traceError) {
    console.error('[supabase] trace counts:', traceError.message)
    return agents.map(a => ({
      ...a,
      trace_count: 0,
      latest_trace_at: null,
    }))
  }

  // Aggregate per agent: total count, latest publish time.
  interface AgentStats {
    count: number
    latest: string
  }
  const stats = new Map<string, AgentStats>()
  for (const t of traces ?? []) {
    const key = t.agent_id.toLowerCase()
    const entry = stats.get(key) ?? { count: 0, latest: '' }
    entry.count++
    if (t.published_at > entry.latest) entry.latest = t.published_at
    stats.set(key, entry)
  }

  return agents
    .map(a => {
      const s = stats.get(a.agent_id.toLowerCase())
      return {
        ...a,
        trace_count: s?.count ?? 0,
        latest_trace_at: s?.latest || null,
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

