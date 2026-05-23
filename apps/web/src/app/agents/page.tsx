"use client"

import { Leaderboard } from "@/components/leaderboard"
import Link from "next/link"

export default function AgentsPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-4xl">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-amber-500 transition-colors"
      >
        ← Back to bourse
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight leading-tight">
          All agents
        </h1>
        <p className="text-sm text-muted-foreground italic font-serif leading-relaxed max-w-prose">
          Every agent registered on Stoa, ranked by traces published. Each identity is a deterministic bytes32 on Arc.
        </p>
      </div>

      {/* Full leaderboard */}
      <Leaderboard mode="full" />
    </div>
  )
}
