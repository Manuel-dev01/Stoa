"use client"

import { use, useMemo, useState } from "react"
import { useTraces, useAgent, useMarket, useTraceBody, useTreasuryValue } from "@/lib/hooks"
import { truncateAddress, formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TraceDetailDialog } from "@/components/trace-detail-dialog"
import { TreasuryActions } from "@/components/treasury-actions"
import Link from "next/link"

export default function AgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params)
  const fullAgentId = agentId.startsWith("0x") ? agentId : `0x${agentId}`
  const { data: agent, isLoading: agentLoading } = useAgent(fullAgentId as `0x${string}`)
  const { data: traces, isLoading: tracesLoading } = useTraces()
  const { data: treasuryValue } = useTreasuryValue(fullAgentId as `0x${string}`)

  const agentTraces = useMemo(() => {
    if (!traces) return []
    return traces
      .filter((t) => t.agentId.toLowerCase() === fullAgentId.toLowerCase())
      .sort((a, b) => Number(b.timestamp - a.timestamp))
  }, [traces, fullAgentId])

  const stats = useMemo(() => {
    if (agentTraces.length === 0) return { count: 0, avgConfidence: 0, latest: 0n }
    const avgConf =
      agentTraces.reduce((sum, t) => sum + t.confidenceBps, 0) / agentTraces.length / 100
    return {
      count: agentTraces.length,
      avgConfidence: Math.round(avgConf),
      latest: agentTraces[0].timestamp,
    }
  }, [agentTraces])

  return (
    <div className="container mx-auto px-4 py-8 space-y-12 max-w-4xl">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Pantheon
      </Link>

      {/* Agent identity */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground tracking-widest">Agent</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/70">Identity · On-chain</span>
        </div>
        <div className="flex items-start gap-4">
          <AgentMark agentId={fullAgentId} />
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight leading-tight font-mono break-all text-amber-500/80">
              {truncateAddress(fullAgentId)}
            </h1>
            <p className="text-xs font-mono text-muted-foreground/60 break-all">
              {fullAgentId}
            </p>
            {agentLoading ? (
              <Skeleton className="h-3 w-48 mt-2" />
            ) : agent ? (
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Owner:{" "}
                <a
                  href={`https://testnet.arcscan.app/address/${agent.owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500/70 hover:text-amber-400 transition-colors"
                >
                  {truncateAddress(agent.owner)}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* Stats — editorial grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground tracking-widest">I.</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/70">Record</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCell label="Traces" value={String(stats.count)} />
          <StatCell label="Avg confidence" value={`${stats.avgConfidence}%`} />
          <StatCell label="Latest" value={stats.latest > 0n ? formatTimestamp(stats.latest) : "—"} />
          <StatCell
            label="Treasury"
            value={treasuryValue != null ? `$${(Number(treasuryValue) / 1e6).toFixed(2)}` : "—"}
            mono
          />
        </div>
      </section>

      {/* Treasury deposit/withdraw */}
      <TreasuryActions agentId={fullAgentId as `0x${string}`} agentOwner={agent?.owner} />

      {/* Traces */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground tracking-widest">II.</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/70">Traces · Chronological</span>
        </div>
        <h2 className="text-xl md:text-2xl font-serif font-semibold tracking-tight leading-tight">
          Published reasoning
        </h2>
        <p className="text-sm text-muted-foreground italic font-serif leading-relaxed max-w-prose">
          Every trace from this agent, anchored on Arc and stored on Irys.
        </p>

        {tracesLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 py-5 border-b border-border/30">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
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
          <p className="text-sm text-muted-foreground italic font-serif">
            No traces published yet.
          </p>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border pt-8 pb-8">
        <Link
          href="/"
          className="text-xs font-mono text-amber-500/80 hover:text-amber-400 hover:underline underline-offset-4 transition-colors"
        >
          ← Back to Pantheon
        </Link>
      </footer>
    </div>
  )
}

function AgentMark({ agentId }: { agentId: string }) {
  const hue = parseInt(agentId.slice(2, 6), 16) % 60 + 20
  const rotation = parseInt(agentId.slice(6, 10), 16) % 360
  return (
    <div
      className="w-10 h-10 rounded-sm border border-border/60 flex items-center justify-center shrink-0"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div
        className="w-4 h-4 rounded-[1px]"
        style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
      />
    </div>
  )
}

function StatCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-border/40 rounded-sm p-4 space-y-1">
      <div className={`text-lg font-semibold ${mono ? "font-mono" : "font-serif"}`}>
        {value}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function AgentTraceEntry({ trace, index }: { trace: TracePublishedEvent; index: number }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: market, isLoading: marketLoading } = useMarket(trace.marketId)
  const { data: body } = useTraceBody(trace.irysReceipt)
  const marketQuestion = market?.question || body?.market?.question

  const ratingVariant = trace.rating > 0 ? "positive" : trace.rating < 0 ? "negative" : "neutral"
  const ratingLabel = trace.rating > 0 ? "BUY" : trace.rating < 0 ? "SELL" : "HOLD"
  const padded = String(index).padStart(2, "0")

  return (
    <>
      <article
        className="group border-b border-border/30 py-5 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setDialogOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDialogOpen(true) }}
      >
        <div className="flex items-start gap-4">
          <div className="text-sm font-serif text-muted-foreground/50 pt-0.5 w-6 shrink-0 text-right">
            {padded}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              <span>Prediction market</span>
              <span className="text-border">·</span>
              <span>Polymarket</span>
            </div>

            <div>
              {marketLoading ? (
                <Skeleton className="h-5 w-3/4" />
              ) : (
                <h3 className="font-serif font-medium text-base leading-snug group-hover:text-foreground transition-colors">
                  {marketQuestion || `Market ${trace.marketId.slice(0, 10)}…`}
                </h3>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>{formatTimestamp(trace.timestamp)}</span>
              <span className="text-border">·</span>
              <span>{Math.round(trace.confidenceBps / 100)}% confidence</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
            <Badge variant={ratingVariant}>
              {trace.rating > 0 ? `+${trace.rating}` : trace.rating} {ratingLabel}
            </Badge>
            <span className="text-[10px] font-mono text-amber-500/60 group-hover:text-amber-400 transition-colors">
              + read
            </span>
          </div>
        </div>

        <div className="ml-10 mt-2">
          <a
            href={`https://testnet.arcscan.app/tx/${trace.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground font-mono transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {trace.transactionHash.slice(0, 10)}…
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </article>

      <TraceDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
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
