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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              {marketLoading ? (
                <Skeleton className="h-5 w-3/4" />
              ) : (
                <h3 className="font-medium text-sm leading-snug truncate">
                  {market?.question || `Market ${trace.marketId.slice(0, 10)}...`}
                </h3>
              )}
            </div>
            <Badge variant={ratingVariant} className="shrink-0">
              {trace.rating > 0 ? `+${trace.rating}` : trace.rating} {ratingLabel}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            Agent's call: {ratingLabel} at {Math.round(trace.confidenceBps / 100)}% confidence — read the full bull/bear debate
          </p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{truncateAddress(trace.agentId)}</span>
            <span>·</span>
            <span>{Math.round(trace.confidenceBps / 100)}% confidence</span>
            <span>·</span>
            <span>{formatTimestamp(trace.timestamp)}</span>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            Read full reasoning
          </Button>
          <a
            href={`https://testnet.arcscan.app/tx/${trace.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            {trace.transactionHash.slice(0, 10)}...
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
