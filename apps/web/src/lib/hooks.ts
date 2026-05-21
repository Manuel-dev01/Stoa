"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { usePublicClient, useReadContract, useWriteContract } from "wagmi"
import { getAllTraces, getAgent, type TracePublishedEvent } from "./contracts"
import { stoaTreasuryAbi } from "./shared/stoaTreasury"

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
