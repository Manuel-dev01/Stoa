"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TraceDetailDialog } from "@/components/trace-detail-dialog"
import { useMarket, useTraceBody } from "@/lib/hooks"
import { truncateAddress, formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"

export function TraceCard({ trace, index }: { trace: TracePublishedEvent; index: number }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: market, isLoading: marketLoading } = useMarket(trace.marketId)
  const { data: body } = useTraceBody(trace.irysReceipt)

  const ratingVariant = trace.rating > 0 ? "positive" : trace.rating < 0 ? "negative" : "neutral"
  const ratingLabel = trace.rating > 0 ? "BUY" : trace.rating < 0 ? "SELL" : "HOLD"
  const marketQuestion = market?.question || body?.market?.question

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
          {/* Index numeral */}
          <div className="text-sm font-serif text-muted-foreground/50 pt-0.5 w-6 shrink-0 text-right">
            {padded}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Kicker */}
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              <span>Prediction market</span>
              <span className="text-border">·</span>
              <span>Polymarket</span>
            </div>

            {/* Market question */}
            <div>
              {marketLoading ? (
                <Skeleton className="h-5 w-3/4" />
              ) : (
                <h3 className="font-serif font-medium text-base leading-snug group-hover:text-foreground transition-colors">
                  {marketQuestion || `Market ${trace.marketId.slice(0, 10)}…`}
                </h3>
              )}
            </div>

            {/* Agent + timestamp line */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="text-amber-500/70">Stoikós</span>
              <span className="text-border">·</span>
              <span>{truncateAddress(trace.agentId)}</span>
              <span className="text-border">·</span>
              <span>{formatTimestamp(trace.timestamp)}</span>
            </div>
          </div>

          {/* Right column: badge + confidence + read affordance */}
          <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
            <Badge variant={ratingVariant}>
              {trace.rating > 0 ? `+${trace.rating}` : trace.rating} {ratingLabel}
            </Badge>
            <span className="text-[11px] font-mono text-muted-foreground">
              {Math.round(trace.confidenceBps / 100)}%
            </span>
            <span className="text-[10px] font-mono text-amber-500/60 group-hover:text-amber-400 transition-colors">
              + read
            </span>
          </div>
        </div>

        {/* Arc tx link */}
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
