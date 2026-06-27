"use client"

import { useMemo, useState } from "react"
import { useTraces, useTracesFromDB } from "@/lib/hooks"
import { TraceCard } from "@/components/trace-card"
import { Skeleton } from "@/components/ui/skeleton"

const PAGE = 12

export default function TracesPage() {
  const { data: traces, isLoading } = useTraces()
  const { data: dbRows } = useTracesFromDB()
  const [venue, setVenue] = useState<"all" | "polymarket" | "kalshi">("all")
  const [page, setPage] = useState(1)

  // trace_hash → venue, from the indexed rows (the chain marketId loses the
  // venue prefix, so the DB column is the source of truth for venue).
  const venueByHash = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of dbRows ?? []) m.set(r.trace_hash.toLowerCase(), r.venue ?? "polymarket")
    return m
  }, [dbRows])

  const newestFirst = useMemo(() => [...(traces ?? [])].reverse(), [traces])

  const filtered = useMemo(() => {
    if (venue === "all") return newestFirst
    return newestFirst.filter(
      (t) => (venueByHash.get(t.traceHash.toLowerCase()) ?? "polymarket") === venue
    )
  }, [newestFirst, venue, venueByHash])

  const shown = filtered.slice(0, page * PAGE)

  return (
    <div className="mx-auto max-w-[900px] px-6 pb-24 pt-14 sm:px-12">
      <div className="mb-2 font-mono text-[11px] tracking-[0.2em] text-verdigris">
        BUILT FOR THE SKEPTIC
      </div>
      <h1 className="font-serif text-[clamp(34px,5vw,56px)] font-medium leading-none tracking-tight">
        Every synthesis, anchored.
      </h1>
      <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-ash">
        The full on-chain log of the Triad&apos;s published reasoning. Each trace is hashed,
        pinned to Irys, and anchored on Arc — open any row to read the bull/bear/synthesis and
        verify the hash yourself.
      </p>

      {/* venue filter */}
      <div className="mt-8 flex gap-1.5">
        {(["all", "polymarket", "kalshi"] as const).map((v) => (
          <button
            key={v}
            onClick={() => {
              setVenue(v)
              setPage(1)
            }}
            className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
              venue === v
                ? "border-gold/40 bg-gold/5 text-gold"
                : "border-hairline text-ash hover:text-marble"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2 border-b border-hairline-soft py-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : shown.length > 0 ? (
          <div className="trace-list">
            {shown.map((trace, i) => (
              <TraceCard
                key={trace.traceHash}
                trace={trace}
                index={i + 1}
                venue={venueByHash.get(trace.traceHash.toLowerCase())}
              />
            ))}
          </div>
        ) : (
          <p className="py-10 font-serif text-lg italic text-ash">No traces in this view yet.</p>
        )}
      </div>

      {shown.length < filtered.length && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="mt-8 w-full rounded-md border border-hairline py-3 font-mono text-[12px] text-ash transition-colors hover:text-gold"
        >
          LOAD MORE · {shown.length}/{filtered.length}
        </button>
      )}
    </div>
  )
}
