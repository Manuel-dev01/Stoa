"use client"

import { useQuery } from "@tanstack/react-query"
import { type TracePublishedEvent } from "./contracts"
import { getTraces, getAgents, getAgentsWithTraceCounts, type TraceRow, type AgentRow, type AgentWithTraceCount } from "./supabase"

/** Map a Supabase trace row into the on-chain-event shape the trace stream
 *  components consume. The chain is still the source of truth, but the
 *  indexer materializes every TracePublished event into Supabase as it
 *  happens, and Supabase keeps that history forever — whereas the Arc RPC
 *  prunes historical logs, so a direct getLogs walk fails for older traces
 *  with "pruned history unavailable". Reading the indexed cache makes the
 *  trace stream robust to RPC log retention.
 */
function rowToEvent(r: TraceRow): TracePublishedEvent {
  return {
    agentId: r.agent_id as `0x${string}`,
    marketId: r.market_id as `0x${string}`,
    traceHash: r.trace_hash as `0x${string}`,
    rating: r.rating,
    confidenceBps: r.confidence_bps,
    irysReceipt: r.irys_receipt,
    timestamp: BigInt(Math.floor(new Date(r.published_at).getTime() / 1000)),
    blockNumber: BigInt(r.block_number || 0),
    transactionHash: (r.arc_tx_hash || "0x0") as `0x${string}`,
  }
}

export function useTraces() {
  return useQuery<TracePublishedEvent[]>({
    queryKey: ["traces"],
    queryFn: async () => {
      // getTraces() returns rows newest-first; reverse to oldest-first so
      // existing consumers that do `[...traces].reverse()` to get newest-on-top
      // continue to behave identically to the old on-chain getLogs path.
      const rows = await getTraces()
      return rows.map(rowToEvent).reverse()
    },
    refetchInterval: 15_000,
  })
}

export function useTracesFromDB() {
  return useQuery<TraceRow[]>({
    queryKey: ["traces-db"],
    queryFn: getTraces,
    refetchInterval: 15_000,
  })
}

export function useAgentsFromDB() {
  return useQuery<AgentRow[]>({
    queryKey: ["agents-db"],
    queryFn: getAgents,
    refetchInterval: 15_000,
  })
}

export function useAgentsWithTraceCounts() {
  return useQuery<AgentWithTraceCount[]>({
    queryKey: ["agents-with-traces"],
    queryFn: getAgentsWithTraceCounts,
    refetchInterval: 15_000,
  })
}

/** Agent identity from the indexed `agents` table (no on-chain read needed —
 *  the indexer mirrors the registry into Supabase). */
export function useAgent(agentId: `0x${string}`) {
  return useQuery<AgentRow | null>({
    queryKey: ["agent", agentId],
    queryFn: async () => {
      const agents = await getAgents()
      return agents.find((a) => a.agent_id.toLowerCase() === agentId.toLowerCase()) ?? null
    },
    enabled: !!agentId,
  })
}

interface TraceBody {
  marketId?: string
  reasoning?: { bull?: string; bear?: string; synthesis?: string }
  decision?: { rating?: number; confidenceBps?: number; sizeUsdc?: number }
  modelMetadata?: { framework?: string; quickThinkModel?: string; deepThinkModel?: string }
  market?: { question?: string; venue?: string; resolutionAt?: string | null }
  [key: string]: unknown
}

export function useTraceBody(irysReceipt: string | undefined) {
  return useQuery<TraceBody>({
    queryKey: ["traceBody", irysReceipt],
    queryFn: async () => {
      const resp = await fetch(`https://gateway.irys.xyz/${irysReceipt}`)
      if (!resp.ok) throw new Error(`Irys returned ${resp.status}`)
      return resp.json()
    },
    enabled: !!irysReceipt,
    staleTime: Infinity,
  })
}

interface GammaMarket {
  conditionId: string
  question: string
  outcomes?: string[]
  liquidity?: number
}

/** Fetch all markets once (paginated) and cache for 5 minutes. */
function useAllMarkets() {
  return useQuery<GammaMarket[]>({
    queryKey: ["all-markets"],
    queryFn: async () => {
      const all: GammaMarket[] = []
      for (let offset = 0; offset < 1000; offset += 100) {
        const resp = await fetch(
          `https://gamma-api.polymarket.com/markets?limit=100&offset=${offset}`
        )
        if (!resp.ok) break
        const markets: Record<string, unknown>[] = await resp.json()
        if (!markets.length) break
        for (const m of markets) {
          const cid = ((m.conditionId as string) || (m.condition_id as string) || "").toLowerCase()
          if (!cid) continue
          all.push({
            conditionId: cid,
            question: (m.question as string) || "",
            outcomes: m.outcomes as string[] | undefined,
            liquidity: m.liquidity as number | undefined,
          })
        }
      }
      return all
    },
    staleTime: 5 * 60_000,
  })
}

export function useMarket(conditionId: string | undefined) {
  const { data: allMarkets } = useAllMarkets()
  return useQuery<GammaMarket | null>({
    queryKey: ["market", conditionId],
    queryFn: () => {
      if (!conditionId || !allMarkets) return null
      const target = conditionId.toLowerCase()
      return allMarkets.find((m) => m.conditionId === target) ?? null
    },
    enabled: !!conditionId && !!allMarkets,
    staleTime: 5 * 60_000,
  })
}

