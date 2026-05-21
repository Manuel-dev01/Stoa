"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TraceDetailDialog } from "@/components/trace-detail-dialog"
import { useMarket } from "@/lib/hooks"
import { truncateAddress, formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"

export function TraceCard({ trace }: { trace: TracePublishedEvent }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: market, isLoading: marketLoading } = useMarket(trace.marketId)

  const ratingVariant = trace.rating > 0 ? "positive" : trace.rating < 0 ? "negative" : "neutral"
  const ratingLabel = trace.rating > 0 ? "BUY" : trace.rating < 0 ? "SELL" : "HOLD"

  return (
    <>
      <Card className={marketLoading ? "animate-pulse" : ""}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1 min-w-0">
              {marketLoading ? (
                <Skeleton className="h-5 w-3/4" />
              ) : (
                <h3 className="font-serif font-medium text-base leading-snug">
                  {market?.question || `Market ${trace.marketId.slice(0, 10)}...`}
                </h3>
              )}
            </div>
            <Badge variant={ratingVariant} className="shrink-0">
              {trace.rating > 0 ? `+${trace.rating}` : trace.rating} {ratingLabel}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Agent's call: {ratingLabel} at {Math.round(trace.confidenceBps / 100)}% confidence
          </p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span>{truncateAddress(trace.agentId)}</span>
            <span>·</span>
            <span>{Math.round(trace.confidenceBps / 100)}%</span>
            <span>·</span>
            <span>{formatTimestamp(trace.timestamp)}</span>
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button
            variant="default"
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-background"
            onClick={() => setDialogOpen(true)}
          >
            Read full reasoning
          </Button>
          <a
            href={`https://testnet.arcscan.app/tx/${trace.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-mono ml-auto"
          >
            {trace.transactionHash.slice(0, 10)}…
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </CardFooter>
      </Card>

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
