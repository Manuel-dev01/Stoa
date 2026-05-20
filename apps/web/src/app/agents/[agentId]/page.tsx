"use client"

import { use } from "react"
import { useMemo, useState } from "react"
import { useTraces, useAgent, useMarket } from "@/lib/hooks"
import { truncateAddress, formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TraceDetailDialog } from "@/components/trace-detail-dialog"

export default function AgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params)
  const fullAgentId = agentId.startsWith("0x") ? agentId : `0x${agentId}`
  const { data: agent, isLoading: agentLoading } = useAgent(fullAgentId as `0x${string}`)
  const { data: traces, isLoading: tracesLoading } = useTraces()

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
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Agent header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-lg font-semibold font-mono break-all">{fullAgentId}</h1>
          <CopyButton text={fullAgentId} />
        </div>
        {agentLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : agent ? (
          <p className="text-sm text-muted-foreground">
            Owner:{" "}
            <a
              href={`https://testnet.arcscan.app/address/${agent.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:underline"
            >
              {agent.owner}
            </a>
          </p>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{stats.count}</div>
            <div className="text-xs text-muted-foreground">Traces</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
            <div className="text-xs text-muted-foreground">Avg confidence</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">
              {stats.latest > 0n ? formatTimestamp(stats.latest) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Latest trace</div>
          </CardContent>
        </Card>
      </div>

      {/* Trace list */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Traces</h2>
        {tracesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : agentTraces.length > 0 ? (
          <div className="space-y-4">
            {agentTraces.map((trace) => (
              <AgentTraceCard key={trace.transactionHash} trace={trace} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No traces from this agent</p>
        )}
      </section>
    </div>
  )
}

function AgentTraceCard({ trace }: { trace: TracePublishedEvent }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: market } = useMarket(trace.marketId)

  const ratingVariant = trace.rating > 0 ? "positive" : trace.rating < 0 ? "negative" : "neutral"
  const ratingLabel = trace.rating > 0 ? "BUY" : trace.rating < 0 ? "SELL" : "HOLD"

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3 className="font-medium text-sm leading-snug truncate flex-1">
              {market?.question || `Market ${trace.marketId.slice(0, 10)}...`}
            </h3>
            <Badge variant={ratingVariant} className="shrink-0">
              {trace.rating > 0 ? `+${trace.rating}` : trace.rating} {ratingLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{Math.round(trace.confidenceBps / 100)}% confidence</span>
            <span>·</span>
            <span>{formatTimestamp(trace.timestamp)}</span>
          </div>
        </CardContent>
        <div className="px-6 pb-6">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            Read full reasoning
          </Button>
        </div>
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? "✓" : "📋"}
    </Button>
  )
}
