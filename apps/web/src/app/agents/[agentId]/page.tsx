"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import { useTraces, useAgent, useMarket, useTraceBody } from "@/lib/hooks"
import { formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"
import { shortHash } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TraceDetailDialog } from "@/components/trace-detail-dialog"
import { TriadMark } from "@/components/triad-mark"

export default function AgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params)
  const fullAgentId = (agentId.startsWith("0x") ? agentId : `0x${agentId}`) as `0x${string}`
  const { data: agent } = useAgent(fullAgentId)
  const { data: traces, isLoading } = useTraces()

  const agentTraces = useMemo(() => {
    if (!traces) return []
    return traces
      .filter((t) => t.agentId.toLowerCase() === fullAgentId.toLowerCase())
      .sort((a, b) => Number(b.timestamp - a.timestamp))
  }, [traces, fullAgentId])

  const stats = useMemo(() => {
    if (agentTraces.length === 0) return { count: 0, avgConfidence: 0, latest: 0n }
    const avg = agentTraces.reduce((s, t) => s + t.confidenceBps, 0) / agentTraces.length / 100
    return { count: agentTraces.length, avgConfidence: Math.round(avg), latest: agentTraces[0].timestamp }
  }, [agentTraces])

  return (
    <div className="mx-auto max-w-[900px] space-y-12 px-6 py-12 sm:px-12">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ash transition-colors hover:text-gold"
      >
        ← THE TRIAD
      </Link>

      {/* identity */}
      <header className="flex items-start gap-4">
        <TriadMark size={44} />
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-verdigris">
            {agent?.display_handle ?? "Agent"} · on-chain identity
          </div>
          <h1 className="break-all font-mono text-xl font-medium text-gold">
            {shortHash(fullAgentId, 12, 8)}
          </h1>
          <p className="break-all font-mono text-[11px] text-mono-dim">{fullAgentId}</p>
          {agent?.owner_address && (
            <p className="font-mono text-[11px] text-ash">
              owner{" "}
              <a
                href={`https://testnet.arcscan.app/address/${agent.owner_address}`}
                target="_blank"
                rel="noreferrer"
                className="text-gold/80 transition-colors hover:text-gold"
              >
                {shortHash(agent.owner_address, 8, 6)}
              </a>
            </p>
          )}
        </div>
      </header>

      {/* stats */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
        {[
          ["TRACES", String(stats.count)],
          ["AVG CONFIDENCE", `${stats.avgConfidence}%`],
          ["LATEST", stats.latest > 0n ? formatTimestamp(stats.latest) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-panel px-4 py-5 text-center">
            <div className="font-serif text-[26px] text-marble">{value}</div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-mono-dim">{label}</div>
          </div>
        ))}
      </div>

      {/* traces */}
      <section className="space-y-5">
        <h2 className="font-serif text-[26px]">Published reasoning</h2>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 border-b border-hairline-soft py-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : agentTraces.length > 0 ? (
          <div className="agent-traces-list">
            {agentTraces.map((trace, i) => (
              <AgentTraceEntry key={trace.transactionHash} trace={trace} index={i + 1} />
            ))}
          </div>
        ) : (
          <p className="font-serif italic text-ash">No traces published yet.</p>
        )}
      </section>
    </div>
  )
}

function AgentTraceEntry({ trace, index }: { trace: TracePublishedEvent; index: number }) {
  const [open, setOpen] = useState(false)
  const { data: market, isLoading } = useMarket(trace.marketId)
  const { data: body } = useTraceBody(trace.irysReceipt)
  const question = market?.question || body?.market?.question
  const ratingVariant = trace.rating > 0 ? "positive" : trace.rating < 0 ? "negative" : "neutral"
  const ratingLabel = trace.rating > 0 ? "BUY" : trace.rating < 0 ? "SELL" : "HOLD"

  return (
    <>
      <article
        className="group cursor-pointer border-b border-hairline-soft py-5 transition-colors hover:bg-basalt/40"
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true)
        }}
      >
        <div className="flex items-start gap-4">
          <div className="w-6 shrink-0 pt-0.5 text-right font-serif text-sm text-mono-dim">
            {String(index).padStart(2, "0")}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {isLoading ? (
              <Skeleton className="h-5 w-3/4" />
            ) : (
              <h3 className="font-serif text-base leading-snug text-marble">
                {question || `Market ${shortHash(trace.marketId)}`}
              </h3>
            )}
            <div className="font-mono text-[11px] text-ash">
              {formatTimestamp(trace.timestamp)} · {Math.round(trace.confidenceBps / 100)}% confidence
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
            <Badge variant={ratingVariant}>
              {trace.rating > 0 ? `+${trace.rating}` : trace.rating} {ratingLabel}
            </Badge>
            <span className="font-mono text-[10px] text-gold/60 transition-colors group-hover:text-gold">
              + read
            </span>
          </div>
        </div>
      </article>

      <TraceDetailDialog
        open={open}
        onOpenChange={setOpen}
        irysReceipt={trace.irysReceipt}
        marketId={trace.marketId}
        agentId={trace.agentId}
        rating={trace.rating}
        confidenceBps={trace.confidenceBps}
        traceHash={trace.traceHash}
        transactionHash={trace.transactionHash}
      />
    </>
  )
}
