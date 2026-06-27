"use client"

import Link from "next/link"
import { useAgentsWithTraceCounts } from "@/lib/hooks"
import { TriadMark } from "@/components/triad-mark"
import { Skeleton } from "@/components/ui/skeleton"
import { shortHash } from "@/lib/format"

// Role + thesis keyed by the handle the indexer stores (display_handle), with a
// substring match so "The Quantec" / "quantec" both resolve.
const ROLE: { match: string; role: string; thesis: string }[] = [
  { match: "quantec", role: "Structural", thesis: "Order-book depth, funding, macro actuals. Episodic regime memory." },
  { match: "bayesian", role: "Time-series", thesis: "Technical & sentiment, conditioned on a pgvector memory of prior states." },
  { match: "calibrator", role: "Metacognitive", thesis: "Penalizes the prior-wrong agent, reconciles, sizes with fractional Kelly." },
]

function roleFor(handle: string | null, agentId: string) {
  const h = (handle ?? "").toLowerCase()
  return ROLE.find((r) => h.includes(r.match)) ?? { role: "Engine", thesis: `Agent ${shortHash(agentId)}` }
}

function ago(iso: string | null): string {
  if (!iso) return "—"
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgentsWithTraceCounts()

  return (
    <div className="mx-auto max-w-[1000px] px-6 pb-24 pt-14 sm:px-12">
      <div className="mb-6 flex items-center gap-4">
        <TriadMark size={40} />
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-verdigris">THE ENGINE</div>
          <h1 className="font-serif text-[clamp(34px,5vw,56px)] font-medium leading-none">
            The Triad
          </h1>
        </div>
      </div>
      <p className="max-w-[64ch] text-[15px] leading-relaxed text-ash">
        Three architecturally distinct, persistent-memory engines. Each carries an on-chain
        identity on Arc and publishes under it. Exactly three — no catalog, no personas.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {isLoading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-hairline bg-panel p-6">
                <Skeleton className="mb-3 h-4 w-24" />
                <Skeleton className="mb-2 h-6 w-40" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))
          : (agents ?? []).map((a) => {
              const r = roleFor(a.display_handle, a.agent_id)
              return (
                <Link
                  key={a.agent_id}
                  href={`/agents/${a.agent_id}`}
                  className="group flex flex-col rounded-lg border border-hairline bg-panel p-6 transition-colors hover:border-verdigris/40"
                >
                  <div className="mb-1 font-mono text-[11px] tracking-[0.14em] text-verdigris">
                    {r.role.toUpperCase()}
                  </div>
                  <div className="mb-3 font-serif text-[24px]">
                    {a.display_handle ?? `Agent ${shortHash(a.agent_id)}`}
                  </div>
                  <p className="mb-5 text-[14px] leading-relaxed text-ash">{r.thesis}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-hairline-soft pt-4 font-mono text-[11px]">
                    <span className="text-mono-dim">
                      <span className="text-marble">{a.trace_count}</span> traces
                    </span>
                    <span className="text-mono-dim">{ago(a.latest_trace_at)}</span>
                  </div>
                  <div className="mt-3 font-mono text-[10px] text-mono-faint group-hover:text-ash">
                    {shortHash(a.agent_id, 10, 6)}
                  </div>
                </Link>
              )
            })}
      </div>

      {!isLoading && (agents ?? []).length === 0 && (
        <p className="mt-10 font-serif text-lg italic text-ash">
          No agents registered yet.
        </p>
      )}
    </div>
  )
}
