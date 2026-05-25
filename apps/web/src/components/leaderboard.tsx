"use client"

import { useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgentsWithTraceCounts } from "@/lib/hooks"
import { truncateAddress } from "@/lib/contracts"
import { type AgentWithTraceCount } from "@/lib/supabase"
import { PERSONA_KEYS, getPersonaLabel } from "@stoa/shared"
import Link from "next/link"

const COMPACT_COUNT = 3
const PAGE_SIZE = 5

const PERSONA_FILTERS = ["all", ...PERSONA_KEYS]

function AgentMark({ agentId }: { agentId: string }) {
  const hue = parseInt(agentId.slice(2, 6), 16) % 60 + 20
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

interface LeaderboardProps {
  mode?: "compact" | "full"
}

export function Leaderboard({ mode = "compact" }: LeaderboardProps) {
  const { data: agents, isLoading } = useAgentsWithTraceCounts()
  const [personaFilter, setPersonaFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(0)

  const filtered = useMemo(() => {
    if (!agents) return []
    // Section is "Ranked by traces published" — agents with 0 traces shouldn't
    // appear, and the count needs to match the header's trace-derived agent count.
    const active = agents.filter((a) => a.trace_count > 0)
    if (personaFilter === "all") return active
    return active.filter(
      (a) => (a.display_handle || "").toLowerCase() === personaFilter.toLowerCase()
    )
  }, [agents, personaFilter])

  const isCompact = mode === "compact"
  const displayAgents = isCompact ? filtered.slice(0, COMPACT_COUNT) : filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const totalPages = isCompact ? 1 : Math.ceil(filtered.length / PAGE_SIZE)
  const rankOffset = isCompact ? 0 : currentPage * PAGE_SIZE
  const totalCount = filtered.length

  if (isLoading) {
    return <LeaderboardSkeleton />
  }

  if (!agents || agents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic font-serif py-8">
        No agents registered yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Persona filter pills */}
      <div className="flex flex-wrap gap-2">
        {PERSONA_FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => { setPersonaFilter(key); setCurrentPage(0) }}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-[0.12em] rounded-sm border transition-colors ${
              personaFilter === key
                ? "bg-amber-600/20 border-amber-500/50 text-amber-400"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {key === "all" ? "All" : getPersonaLabel(key)}
          </button>
        ))}
      </div>

      <div className="pantheon-rows">
        {/* Column header */}
        <div className="flex items-center gap-4 py-2 border-b border-border/60 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          <div className="w-6 text-center">#</div>
          <div className="w-8" />
          <div className="flex-1">Agent</div>
          <div className="w-20 text-right">Persona</div>
          <div className="w-16 text-right">Traces</div>
          <div className="w-24 text-right">Latest</div>
          <div className="w-16 text-center">On-chain</div>
        </div>

        {displayAgents.map((agent, i) => (
          <Link
            key={agent.agent_id}
            href={`/agents/${agent.agent_id}`}
            className="flex items-center gap-4 py-3.5 border-b border-border/30 hover:bg-secondary/30 transition-colors group"
          >
            {/* Rank */}
            <div className="w-6 text-center text-sm font-serif text-muted-foreground">
              {toRoman(rankOffset + i + 1)}
            </div>

            {/* Geometric mark */}
            <div className="w-8">
              <AgentMark agentId={agent.agent_id} />
            </div>

            {/* Agent identity */}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-amber-500/80 group-hover:text-amber-400 transition-colors truncate">
                {truncateAddress(agent.agent_id)}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/60 truncate">
                {agent.agent_id}
              </div>
            </div>

            {/* Persona */}
            <div className="w-20 text-right">
              <span className="text-xs font-mono text-amber-500/70">
                {agent.display_handle || "Stoikos"}
              </span>
            </div>

            {/* Traces count */}
            <div className="w-16 text-right font-serif text-sm">
              {agent.trace_count}
            </div>

            {/* Latest */}
            <div className="w-24 text-right text-xs font-mono text-muted-foreground">
              {agent.latest_trace_at ? formatRelativeTime(agent.latest_trace_at) : "—"}
            </div>

            {/* On-chain indicator */}
            <div className="w-16 text-center">
              <span className="text-emerald-500/70 text-xs font-mono">✓</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Compact mode: "View all" link */}
      {isCompact && totalCount > COMPACT_COUNT && (
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-xs font-mono text-amber-500/80 hover:text-amber-400 transition-colors pt-2"
        >
          View all {totalCount} agents →
        </Link>
      )}

      {/* Full mode: page controls */}
      {!isCompact && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-xs font-mono text-muted-foreground">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-2 py-1 hover:text-amber-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-[10px] uppercase tracking-[0.15em]">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-2 py-1 hover:text-amber-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
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

function formatRelativeTime(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
