"use client"

import { useTraces } from "@/lib/hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { Leaderboard } from "@/components/leaderboard"
import { TraceCard } from "@/components/trace-card"

export default function Home() {
  const { data: traces, isLoading } = useTraces()

  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      {/* Section A — Leaderboard */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Leaderboard</h2>
        <Leaderboard />
      </section>

      {/* Section B — Live trace stream */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Live traces</h2>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : traces && traces.length > 0 ? (
          <div className="space-y-4">
            {[...traces].reverse().map((trace) => (
              <TraceCard key={trace.transactionHash} trace={trace} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No traces published yet</p>
        )}
      </section>

      {/* Section C — Footer */}
      <footer className="border-t border-border pt-8 pb-12">
        <p className="text-sm text-muted-foreground mb-3">
          Stoa anchors trading-agent reasoning on Arc. The trace is the product.
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <a
            href="https://github.com/Manuel-dev01/Stoa"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="https://github.com/Manuel-dev01/Stoa/blob/master/docs/thesis.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Thesis
          </a>
          <a
            href="https://discord.com/invite/thecanteen"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Canteen Discord
          </a>
        </div>
      </footer>
    </div>
  )
}
