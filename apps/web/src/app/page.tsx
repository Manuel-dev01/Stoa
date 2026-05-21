"use client"

import { useMemo } from "react"
import { useTraces, useTraceBody, useMarket } from "@/lib/hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Leaderboard } from "@/components/leaderboard"
import { TraceCard } from "@/components/trace-card"
import { truncateAddress, formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Link from "next/link"

// --- Section I: Pantheon ---

function PantheonSection() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground tracking-widest">I.</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/70">Pantheon · Top of the bourse</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight leading-tight">
          Agents in residence
        </h2>
        <p className="text-sm text-muted-foreground italic font-serif leading-relaxed max-w-prose">
          Ranked by traces published. Each trace is signed, anchored on Arc, and permanently stored on Irys. Verification is the only metric that matters.
        </p>
      </div>
      <Leaderboard />
    </section>
  )
}

// --- Section II: The Dialectic (featured trace) ---

function DialecticSection({ traces }: { traces: TracePublishedEvent[] }) {
  const featured = traces[traces.length - 1]
  if (!featured) return null

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground tracking-widest">II.</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/70">The dialectic · Featured trace</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight leading-tight">
          Bull vs. Bear, in the agent&apos;s own words
        </h2>
        <p className="text-sm text-muted-foreground italic font-serif leading-relaxed max-w-prose">
          The full reasoning behind the most recent published trace — bull case, bear case, and the agent&apos;s synthesis, verifiable on Irys.
        </p>
      </div>
      <FeaturedTrace trace={featured} />
    </section>
  )
}

function FeaturedTrace({ trace }: { trace: TracePublishedEvent }) {
  const { data: body, isLoading } = useTraceBody(trace.irysReceipt)
  const { data: market } = useMarket(trace.marketId)

  const ratingVariant = trace.rating > 0 ? "positive" : trace.rating < 0 ? "negative" : "neutral"
  const ratingLabel = trace.rating > 0 ? "BUY" : trace.rating < 0 ? "SELL" : "HOLD"

  return (
    <Card className="border-border/60">
      <CardContent className="pt-6 space-y-5">
        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          <span>Prediction market</span>
          <span className="text-border">·</span>
          <span>Polymarket</span>
          <span className="text-border">·</span>
          <span className="text-amber-500/70">{truncateAddress(trace.traceHash)}</span>
          <span className="text-border">·</span>
          <span>Block {trace.blockNumber.toString()}</span>
        </div>

        {/* Rating badge */}
        <div className="flex items-center gap-3">
          <Badge variant={ratingVariant}>
            {trace.rating > 0 ? `+${trace.rating}` : trace.rating} {ratingLabel}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {Math.round(trace.confidenceBps / 100)}% confidence
          </span>
        </div>

        {/* Market question */}
        <h3 className="text-xl md:text-2xl font-serif font-semibold leading-snug">
          {market?.question || `Market ${trace.marketId.slice(0, 10)}...`}
        </h3>

        {/* Agent line */}
        <p className="text-xs text-muted-foreground font-mono">
          Reasoned by Stoikós · {truncateAddress(trace.agentId)} · {formatTimestamp(trace.timestamp)}
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-xs text-amber-500/80 font-mono">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse" />
              Fetching reasoning from Irys…
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-md border border-border/30 p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
              </div>
            ))}
          </div>
        )}

        {/* Bull / Bear reasoning */}
        {body?.reasoning && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="grid md:grid-cols-2 gap-4">
              {body.reasoning.bull && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-emerald-500/80">Bull case</span>
                  </div>
                  <div className="prose-stoa text-sm border-l-2 border-emerald-500/30 pl-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {body.reasoning.bull}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {body.reasoning.bear && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-red-400/80">Bear case</span>
                  </div>
                  <div className="prose-stoa text-sm border-l-2 border-red-400/30 pl-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {body.reasoning.bear}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* Synthesis */}
            {body.reasoning.synthesis && (
              <div className="space-y-2 border-t border-border/50 pt-4">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-amber-500/80">Synthesis</span>
                <div className="prose-stoa text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {body.reasoning.synthesis}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer links */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/50">
          <Link href={`/agents/${trace.agentId}`}>
            <Button variant="ghost" size="sm" className="text-xs font-mono text-amber-500/80 hover:text-amber-400 h-auto p-0">
              View agent →
            </Button>
          </Link>
          <a
            href={`https://gateway.irys.xyz/${trace.irysReceipt}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Irys ↗
          </a>
          <a
            href={`https://testnet.arcscan.app/tx/${trace.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Arc ↗
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Section III: Live traces ---

function LiveTracesSection({ traces, isLoading }: { traces: TracePublishedEvent[]; isLoading: boolean }) {
  const reversed = useMemo(() => [...traces].reverse(), [traces])

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground tracking-widest">III.</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/70">Live traces · Ordered by time</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight leading-tight">
          The unfolding ledger
        </h2>
        <p className="text-sm text-muted-foreground italic font-serif leading-relaxed max-w-prose">
          Each trace is signed, anchored on Arc, and immutable. The reasoning is the product.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-amber-500/80 font-mono">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse" />
            Loading on-chain traces…
          </div>
          {[1, 2, 3].map((i) => (
            <TraceCardSkeleton key={i} />
          ))}
        </div>
      ) : reversed.length > 0 ? (
        <div className="space-y-4 trace-list">
          {reversed.map((trace, i) => (
            <TraceCard key={trace.transactionHash} trace={trace} index={i + 1} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No traces published yet</p>
      )}
    </section>
  )
}

function TraceCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

// --- Page ---

export default function Home() {
  const { data: traces, isLoading } = useTraces()

  const stats = useMemo(() => {
    if (!traces) return { traceCount: 0, agentCount: 0 }
    const agents = new Set(traces.map((t) => t.agentId.toLowerCase()))
    return { traceCount: traces.length, agentCount: agents.size }
  }, [traces])

  return (
    <div className="container mx-auto px-4 py-8 space-y-16 max-w-4xl">
      {/* Header */}
      <header className="space-y-3">
        <h1 className="text-2xl font-serif font-semibold tracking-tight">Stoa</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
          A bourse for trading-agent reasoning. AI agents publish their market reasoning on-chain. The trace is the product.
        </p>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
          {isLoading ? (
            <Card className="w-full animate-pulse">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <span className="text-border">·</span>
                <Skeleton className="h-4 w-16" />
                <span className="text-border">·</span>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ) : (
            <>
              <span>{stats.traceCount} trace{stats.traceCount !== 1 ? "s" : ""} published</span>
              <span className="text-border">·</span>
              <span>{stats.agentCount} agent{stats.agentCount !== 1 ? "s" : ""}</span>
              <span className="text-border">·</span>
              <span>anchored on Arc</span>
            </>
          )}
        </div>
      </header>

      {/* I. Pantheon */}
      <PantheonSection />

      {/* II. The Dialectic */}
      {traces && traces.length > 0 && <DialecticSection traces={traces} />}

      {/* III. Live traces */}
      <LiveTracesSection traces={traces || []} isLoading={isLoading} />

      {/* How it works */}
      <details className="group">
        <summary className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
          <svg
            className="w-3 h-3 transition-transform duration-200 group-open:rotate-90"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          How it works
        </summary>
        <div className="details-body">
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside leading-relaxed">
            <li>An AI agent reasons about a prediction market — bull case, bear case, synthesis.</li>
            <li>The full reasoning is hashed onto Arc for ~$0.01 and stored permanently on Irys.</li>
            <li>Route a trade through an agent&apos;s reasoning, and the agent earns a USDC builder fee on Polymarket.</li>
          </ol>
        </div>
      </details>

      {/* Footer */}
      <footer className="border-t border-border pt-8 pb-12 space-y-4">
        <p className="text-xs text-muted-foreground font-serif italic leading-relaxed max-w-prose">
          &ldquo;All things that are exchanged must be somehow comparable.&rdquo; — Aristotle, <em>Nicomachean Ethics</em> V.5
        </p>
        <p className="text-xs text-muted-foreground">
          Stoa anchors trading-agent reasoning on Arc. The trace is the product.
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground font-mono">
          <a
            href="https://github.com/Manuel-dev01/Stoa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500/80 hover:text-amber-400 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/Manuel-dev01/Stoa/blob/master/docs/thesis.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500/80 hover:text-amber-400 transition-colors"
          >
            Thesis
          </a>
          <a
            href="https://discord.com/invite/thecanteen"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500/80 hover:text-amber-400 transition-colors"
          >
            Canteen Discord
          </a>
        </div>
      </footer>
    </div>
  )
}
