"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useTraceBody, useRouteOrder } from "@/lib/hooks"
import { truncateAddress } from "@/lib/contracts"
import { TeaserBlock } from "@/components/teaser-block"
import { Button } from "./ui/button"

interface TraceDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  irysReceipt: string
  marketId: string
  agentId: string
  rating: number
  confidenceBps: number
  traceHash: string
  transactionHash: string
}

export function TraceDetailDialog({
  open,
  onOpenChange,
  irysReceipt,
  marketId,
  agentId,
  rating,
  confidenceBps,
  traceHash,
  transactionHash,
}: TraceDetailDialogProps) {
  const { data: body, isLoading, error, refetch } = useTraceBody(open ? irysReceipt : undefined)
  const routeOrder = useRouteOrder()
  const [routeResult, setRouteResult] = useState<Record<string, unknown> | null>(null)

  const isBuy = rating > 0
  const canRoute = rating !== 0

  const ratingVariant = rating > 0 ? "positive" : rating < 0 ? "negative" : "neutral"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl dialog-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-lg font-serif leading-relaxed">
            {body?.market?.question || `Market ${marketId.slice(0, 10)}...`}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Agent {truncateAddress(agentId)} · Confidence {Math.round(confidenceBps / 100)}%
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 py-2 animate-fade-in">
            <div className="flex items-center gap-2 text-xs text-amber-500/80 font-mono mb-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse" />
              Fetching trace from Irys…
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="pt-2 space-y-2 rounded-md border border-border/50 p-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/6" />
            </div>
            <div className="pt-1 space-y-2 rounded-md border border-border/50 p-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
            <div className="pt-1 space-y-2 rounded-md border border-border/50 p-3">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/6" />
            </div>
            <Skeleton className="h-10 w-full mt-4" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 animate-fade-in">
            <p className="text-muted-foreground mb-4">Unable to load reasoning from Irys</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {body && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Decision */}
            <div className="flex items-center gap-3">
              <Badge variant={ratingVariant} className="text-sm">
                {rating > 0 ? `+${rating}` : rating} {rating > 0 ? "BUY" : rating < 0 ? "SELL" : "HOLD"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {Math.round(confidenceBps / 100)}% confidence
              </span>
              {body.decision?.sizeUsdc != null && body.decision.sizeUsdc > 0 && (
                <span className="text-sm text-muted-foreground">
                  ${body.decision.sizeUsdc} USDC
                </span>
              )}
            </div>

            {/* Bull case */}
            {body.reasoning?.bull && (
              <TeaserBlock
                label="Bull case"
                colorClass="text-emerald-500/80"
                collapsedHeight={64}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {body.reasoning.bull}
                </ReactMarkdown>
              </TeaserBlock>
            )}

            {/* Bear case */}
            {body.reasoning?.bear && (
              <TeaserBlock
                label="Bear case"
                colorClass="text-red-400/80"
                collapsedHeight={64}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {body.reasoning.bear}
                </ReactMarkdown>
              </TeaserBlock>
            )}

            {/* Synthesis */}
            {body.reasoning?.synthesis && (
              <TeaserBlock
                label="Synthesis"
                colorClass="text-amber-500/80"
                collapsedHeight={64}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {body.reasoning.synthesis}
                </ReactMarkdown>
              </TeaserBlock>
            )}

            {/* Model metadata */}
            {body.modelMetadata && (
              <div className="text-xs text-muted-foreground border-t border-border pt-3 font-mono">
                {body.modelMetadata.framework && <span>{body.modelMetadata.framework}</span>}
                {body.modelMetadata.quickThinkModel && (
                  <span> · {body.modelMetadata.quickThinkModel}</span>
                )}
                {body.modelMetadata.deepThinkModel && (
                  <span> · {body.modelMetadata.deepThinkModel}</span>
                )}
              </div>
            )}

            {/* Route this trade */}
            <div className="border-t border-border pt-3">
              {!routeResult && (
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-background active:scale-[0.98] transition-transform"
                  disabled={!canRoute || routeOrder.isPending}
                  onClick={async () => {
                    const result = await routeOrder.mutateAsync({
                      marketId,
                      side: isBuy ? "BUY" : "SELL",
                      price: 0.50,
                      size: body?.decision?.sizeUsdc ?? 10,
                      agentBytes32: agentId,
                    })
                    setRouteResult(result as Record<string, unknown>)
                  }}
                >
                  {routeOrder.isPending
                    ? "Constructing order..."
                    : `Route this ${isBuy ? "BUY" : "SELL"} through agent`}
                </Button>
              )}
              {routeResult && (
                <div className="space-y-2 animate-fade-in-up">
                  <Badge variant="positive" className="text-xs">Dry-run order signed</Badge>
                  <p className="text-xs text-muted-foreground font-mono">
                    Builder: {(routeResult.order as Record<string, unknown>)?.builder ? String((routeResult.order as Record<string, unknown>).builder).slice(0, 10) + "..." : "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {routeResult.message as string}
                  </p>
                </div>
              )}
              {routeOrder.isError && (
                <p className="text-xs text-red-400 mt-2 animate-fade-in">
                  {routeOrder.error instanceof Error ? routeOrder.error.message : "Routing failed"}
                </p>
              )}
            </div>

            {/* Links — mono, precise, evidence */}
            <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1.5 font-mono">
              <div>
                trace: <span className="text-[11px]">{traceHash.slice(0, 10)}…{traceHash.slice(-6)}</span>
              </div>
              <div className="flex gap-4">
                <a
                  href={`https://gateway.irys.xyz/${irysReceipt}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500/80 hover:text-amber-400 transition-colors"
                >
                  Irys ↗
                </a>
                <a
                  href={`https://testnet.arcscan.app/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500/80 hover:text-amber-400 transition-colors"
                >
                  Arc ↗
                </a>
                <a
                  href="https://github.com/Manuel-dev01/Stoa/blob/master/docs/verification.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500/80 hover:text-amber-400 transition-colors"
                >
                  Verify yourself ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
