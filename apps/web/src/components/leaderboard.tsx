"use client"

import { useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useTraces } from "@/lib/hooks"
import { truncateAddress, formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"
import Link from "next/link"

interface AgentRow {
  agentId: string
  traceCount: number
  latestTimestamp: bigint
}

function AgentMark({ agentId }: { agentId: string }) {
  // Deterministic geometric mark from agent ID bytes
  const hue = parseInt(agentId.slice(2, 6), 16) % 60 + 20 // amber range
  const rotation = parseInt(agentId.slice(6, 10), 16) % 360
  return (
    <div
      className="w-8 h-8 rounded-sm border border-border/60 flex items-center justify-center"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div
        className="w-3 h-3 rounded-[1px]"
        style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
      />
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-border/40">
          <Skeleton className="h-6 w-6 rounded-sm" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-8 w-8 rounded-sm" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-6" />
        </div>
      ))}
    </div>
  )
}

export function Leaderboard() {
  const { data: traces, isLoading } = useTraces()

  const agents = useMemo(() => {
    if (!traces) return []
    const map = new Map<string, AgentRow>()
    for (const t of traces) {
      const key = t.agentId.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.traceCount++
        if (t.timestamp > existing.latestTimestamp) existing.latestTimestamp = t.timestamp
      } else {
        map.set(key, { agentId: t.agentId, traceCount: 1, latestTimestamp: t.timestamp })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.traceCount - a.traceCount)
  }, [traces])

  if (isLoading) {
    return <LeaderboardSkeleton />
  }

  if (agents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic font-serif py-8">
        No agents registered yet.
      </p>
    )
  }

  return (
    <div className="pantheon-rows">
      {/* Column header */}
      <div className="flex items-center gap-4 py-2 border-b border-border/60 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
        <div className="w-6 text-center">#</div>
        <div className="w-8" />
        <div className="flex-1">Agent</div>
        <div className="w-16 text-right">Traces</div>
        <div className="w-24 text-right">Latest</div>
        <div className="w-16 text-center">On-chain</div>
      </div>

      {agents.map((agent, i) => (
        <Link
          key={agent.agentId}
          href={`/agents/${agent.agentId}`}
          className="flex items-center gap-4 py-3.5 border-b border-border/30 hover:bg-secondary/30 transition-colors group"
        >
          {/* Rank */}
          <div className="w-6 text-center text-sm font-serif text-muted-foreground">
            {toRoman(i + 1)}
          </div>

          {/* Geometric mark */}
          <div className="w-8">
            <AgentMark agentId={agent.agentId} />
          </div>

          {/* Agent identity */}
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm text-amber-500/80 group-hover:text-amber-400 transition-colors truncate">
              {truncateAddress(agent.agentId)}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/60 truncate">
              {agent.agentId}
            </div>
          </div>

          {/* Traces count */}
          <div className="w-16 text-right font-serif text-sm">
            {agent.traceCount}
          </div>

          {/* Latest */}
          <div className="w-24 text-right text-xs font-mono text-muted-foreground">
            {formatTimestamp(agent.latestTimestamp)}
          </div>

          {/* On-chain indicator */}
          <div className="w-16 text-center">
            <span className="text-emerald-500/70 text-xs font-mono">✓</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function toRoman(n: number): string {
  const numerals: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ]
  let result = ""
  for (const [value, symbol] of numerals) {
    while (n >= value) {
      result += symbol
      n -= value
    }
  }
  return result
}
