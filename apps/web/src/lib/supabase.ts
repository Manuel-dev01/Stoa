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
