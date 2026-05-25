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
  const { data, error } = await supabase
    .from('traces')
    .select('*')
    .order('published_at', { ascending: false })
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
    // Return agents with 0 traces
    return agents.map(a => ({ ...a, trace_count: 0, latest_trace_at: null }))
  }

  // Count traces per agent
  const countMap = new Map<string, { count: number; latest: string }>()
  for (const t of traces ?? []) {
    const key = t.agent_id.toLowerCase()
    const existing = countMap.get(key)
    if (existing) {
      existing.count++
      if (t.published_at > existing.latest) existing.latest = t.published_at
    } else {
      countMap.set(key, { count: 1, latest: t.published_at })
    }
  }

  return agents.map(a => {
    const stats = countMap.get(a.agent_id.toLowerCase())
    return {
      ...a,
      trace_count: stats?.count ?? 0,
      latest_trace_at: stats?.latest ?? null,
    }
  }).sort((a, b) => b.trace_count - a.trace_count)
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
