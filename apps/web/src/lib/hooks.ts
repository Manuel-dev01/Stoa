"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { usePublicClient, useReadContract, useWriteContract } from "wagmi"
import { getAllTraces, getAgent, type TracePublishedEvent } from "./contracts"
import { stoaTreasuryAbi } from "./shared/stoaTreasury"
import { getTraces, getAgents, type TraceRow, type AgentRow } from "./supabase"

const STOA_TREASURY = process.env.NEXT_PUBLIC_STOA_TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000"

export function useTraces() {
  const client = usePublicClient()
  return useQuery<TracePublishedEvent[]>({
    queryKey: ["traces"],
    queryFn: () => getAllTraces(client!),
    enabled: !!client,
    refetchInterval: 30_000,
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

interface RouteOrderParams {
  marketId: string
  side: "BUY" | "SELL"
  price: number
  size: number
  agentBytes32: string
}

export function useRouteOrder() {
  return useMutation({
    mutationFn: async (params: RouteOrderParams) => {
      const resp = await fetch("/api/route-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, dryRun: true }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      return resp.json()
    },
  })
}

export function useTreasuryValue(agentId: `0x${string}` | undefined) {
  return useReadContract({
    address: STOA_TREASURY as `0x${string}`,
    abi: stoaTreasuryAbi,
    functionName: "agentValue",
    args: agentId ? [agentId] : undefined,
    query: { enabled: !!agentId && STOA_TREASURY !== "0x0000000000000000000000000000000000000000" },
  })
}

export function useTreasuryShares(agentId: `0x${string}` | undefined) {
  return useReadContract({
    address: STOA_TREASURY as `0x${string}`,
    abi: stoaTreasuryAbi,
    functionName: "agentShares",
    args: agentId ? [agentId] : undefined,
    query: { enabled: !!agentId && STOA_TREASURY !== "0x0000000000000000000000000000000000000000" },
  })
}

export function useTreasurySubscribe() {
  const { writeContractAsync, isPending } = useWriteContract()
  return {
    subscribe: (agentId: `0x${string}`, amount: bigint) =>
      writeContractAsync({
        address: STOA_TREASURY as `0x${string}`,
        abi: stoaTreasuryAbi,
        functionName: "subscribe",
        args: [agentId, amount],
      }),
    isPending,
  }
}

export function useTreasuryRedeem() {
  const { writeContractAsync, isPending } = useWriteContract()
  return {
    redeem: (agentId: `0x${string}`, shares: bigint) =>
      writeContractAsync({
        address: STOA_TREASURY as `0x${string}`,
        abi: stoaTreasuryAbi,
        functionName: "redeem",
        args: [agentId, shares],
      }),
    isPending,
  }
}

export function useGasFreePublishTrace() {
  return useMutation({
    mutationFn: async (params: {
      privateKey: string
      agentId: `0x${string}`
      traceHash: `0x${string}`
      marketId: `0x${string}`
      rating: number
      confidenceBps: number
      irysReceipt: string
    }) => {
      const { createGasFreeClient } = await import("./paymaster")
      const { STOA_REGISTRY } = await import("@stoa/shared")

      const usdcAddress = (process.env.NEXT_PUBLIC_ARC_USDC || "0x0000000000000000000000000000000000000000") as `0x${string}`
      const bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC
      if (!bundlerRpc) throw new Error("NEXT_PUBLIC_BUNDLER_RPC not set")

      const { bundlerClient, account } = await createGasFreeClient({
        privateKey: params.privateKey,
        bundlerRpc,
        usdcAddress,
      })

      const REGISTRY_ABI = [
        {
          name: "publishTrace",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "agentId", type: "bytes32" },
            { name: "traceHash", type: "bytes32" },
            { name: "marketId", type: "bytes32" },
            { name: "rating", type: "int8" },
            { name: "confidenceBps", type: "uint16" },
            { name: "irysReceipt", type: "string" },
          ],
          outputs: [],
        },
      ] as const

      const hash = await bundlerClient.sendUserOperation({
        account,
        calls: [
          {
            to: STOA_REGISTRY,
            abi: REGISTRY_ABI,
            functionName: "publishTrace",
            args: [
              params.agentId,
              params.traceHash,
              params.marketId,
              params.rating,
              params.confidenceBps,
              params.irysReceipt,
            ],
          },
        ],
      })

      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash })
      return receipt
    },
  })
}
