"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useTraceBody, useRouteOrder } from "@/lib/hooks"
import { truncateAddress } from "@/lib/contracts"
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
  const canRoute = !!body?.decision?.sizeUsdc && body.decision.sizeUsdc > 0 && (rating !== 0)

  const ratingVariant = rating > 0 ? "positive" : rating < 0 ? "negative" : "neutral"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base leading-relaxed">
            {body?.market?.question || `Market ${marketId.slice(0, 10)}...`}
          </DialogTitle>
          <DialogDescription>
            Agent {truncateAddress(agentId)} · Confidence {Math.round(confidenceBps / 100)}%
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Unable to load reasoning from Irys</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {body && (
          <div className="space-y-6">
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
              <div>
                <h4 className="text-sm font-medium text-emerald-400 mb-1">Bull case</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {body.reasoning.bull}
                </p>
              </div>
            )}

            {/* Bear case */}
            {body.reasoning?.bear && (
              <div>
                <h4 className="text-sm font-medium text-red-400 mb-1">Bear case</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {body.reasoning.bear}
                </p>
              </div>
            )}

            {/* Synthesis */}
            {body.reasoning?.synthesis && (
              <div>
                <h4 className="text-sm font-medium mb-1">Synthesis</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {body.reasoning.synthesis}
                </p>
              </div>
            )}

            {/* Model metadata */}
            {body.modelMetadata && (
              <div className="text-xs text-muted-foreground border-t border-border pt-3">
                {body.modelMetadata.framework && <span>Framework: {body.modelMetadata.framework}</span>}
                {body.modelMetadata.quickThinkModel && (
                  <span> · Quick: {body.modelMetadata.quickThinkModel}</span>
                )}
                {body.modelMetadata.deepThinkModel && (
                  <span> · Deep: {body.modelMetadata.deepThinkModel}</span>
                )}
              </div>
            )}

            {/* Route this trade */}
            <div className="border-t border-border pt-3">
              {!routeResult && (
                <Button
                  className="w-full"
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
                <div className="space-y-2">
                  <Badge variant="positive" className="text-xs">Dry-run order signed</Badge>
                  <p className="text-xs text-muted-foreground">
                    Builder field: <code className="text-[11px]">{(routeResult.order as Record<string, unknown>)?.builder ? String((routeResult.order as Record<string, unknown>).builder).slice(0, 18) + "..." : "N/A"}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {routeResult.message as string}
                  </p>
                </div>
              )}
              {routeOrder.isError && (
                <p className="text-xs text-red-400 mt-2">
                  {routeOrder.error instanceof Error ? routeOrder.error.message : "Routing failed"}
                </p>
              )}
            </div>

            {/* Links */}
            <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
              <div>
                Trace hash: <code className="text-[11px]">{traceHash.slice(0, 18)}...</code>
              </div>
              <div>
                <a
                  href={`https://gateway.irys.xyz/${irysReceipt}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  View on Irys
                </a>
                {" · "}
                <a
                  href={`https://testnet.arcscan.app/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  View on Arc
                </a>
              </div>
              <div>
                <a
                  href="https://github.com/Manuel-dev01/Stoa/blob/master/docs/verification.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Verify this trace yourself
                </a>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
