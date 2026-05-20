"use client"

import { useQuery } from "@tanstack/react-query"
import { usePublicClient } from "wagmi"
import { getAllTraces, getAgent, type TracePublishedEvent } from "./contracts"

export function useTraces() {
  const client = usePublicClient()
  return useQuery<TracePublishedEvent[]>({
    queryKey: ["traces"],
    queryFn: () => getAllTraces(client!),
    enabled: !!client,
    refetchInterval: 30_000,
  })
}

export function useAgent(agentId: `0x${string}`) {
  const client = usePublicClient()
  return useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgent(client!, agentId),
    enabled: !!client,
  })
}

interface TraceBody {
  marketId?: string
  reasoning?: { bull?: string; bear?: string; synthesis?: string }
  decision?: { rating?: number; confidenceBps?: number; sizeUsdc?: number }
  modelMetadata?: { framework?: string; quickThinkModel?: string; deepThinkModel?: string }
  market?: { question?: string }
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

export function useMarket(conditionId: string | undefined) {
  return useQuery<GammaMarket | null>({
    queryKey: ["market", conditionId],
    queryFn: async () => {
      if (!conditionId) return null
      const resp = await fetch(
        `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100`
      )
      if (!resp.ok) return null
      const markets: Record<string, unknown>[] = await resp.json()
      const found = markets.find(
        (m) =>
          ((m.conditionId as string) || (m.condition_id as string) || "").toLowerCase() ===
          conditionId.toLowerCase()
      )
      if (!found) return null
      return {
        conditionId: (found.conditionId as string) || (found.condition_id as string) || "",
        question: (found.question as string) || "",
        outcomes: found.outcomes as string[] | undefined,
        liquidity: found.liquidity as number | undefined,
      }
    },
    enabled: !!conditionId,
    staleTime: 5 * 60_000,
  })
}
