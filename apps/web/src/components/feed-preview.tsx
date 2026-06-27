"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import type { PreviewItem } from "@/lib/preview"
import { stanceLabel, confidencePct, shortHash, irysUrl } from "@/lib/format"

const TRIAD_ORDER = ["quantec", "bayesian", "calibrator"] as const
const AGENT_LABEL: Record<string, string> = {
  quantec: "QUANTEC",
  bayesian: "BAYESIAN",
  calibrator: "CALIBR.",
}

function AgentBars({ breakdown }: { breakdown: PreviewItem["agent_breakdown"] }) {
  if (!breakdown) return null
  return (
    <div className="flex flex-col gap-2">
      {TRIAD_ORDER.map((key) => {
        const a = breakdown[key]
        if (!a) return null
        const pct = Math.max(4, Math.min(100, a.confidence_bps / 100))
        const isCalibrator = key === "calibrator"
        return (
          <div key={key} className="flex items-center gap-2">
            <span
              className={`w-[58px] font-mono text-[10px] ${isCalibrator ? "text-gold" : "text-mono-dim"}`}
            >
              {AGENT_LABEL[key]}
            </span>
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-hairline-soft">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: isCalibrator ? "#C8A45D" : "#5FA391" }}
              />
            </div>
            <span className={`font-mono text-[10px] ${isCalibrator ? "text-gold" : "text-ash"}`}>
              {(a.confidence_bps / 10000).toFixed(2)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PreviewCard({ item }: { item: PreviewItem }) {
  const verify = irysUrl(item.irys_hash)
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded border border-verdigris/40 px-2 py-0.5 font-mono text-[10px] text-verdigris">
          {stanceLabel(item.rating)}
        </span>
        <span className="font-mono text-[11px] text-ash">{confidencePct(item.confidence_bps)}%</span>
      </div>
      <h3 className="font-serif text-[22px] leading-tight text-marble">{item.question}</h3>
      <AgentBars breakdown={item.agent_breakdown} />
      <div className="mt-auto flex items-center justify-between border-t border-hairline-soft pt-3">
        <span className="font-mono text-[11px] text-mono-dim">
          ½-kelly <span className="text-gold">{item.kelly_fraction}</span>
        </span>
        {verify ? (
          <a
            href={verify}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-ash transition-colors hover:text-verdigris"
            title={item.irys_hash ?? ""}
          >
            verify · irys ↗
          </a>
        ) : (
          <span className="font-mono text-[11px] text-mono-faint">pending anchor</span>
        )}
      </div>
    </div>
  )
}

function LockedCard() {
  return (
    <Link
      href="/flow"
      className="group flex flex-col justify-between rounded-lg border border-gold/25 bg-[#13100B] p-5 transition-colors hover:border-gold/50"
    >
      <div className="flex items-center justify-between">
        <span className="rounded border border-gold/40 px-2 py-0.5 font-mono text-[10px] text-gold">
          🔒 402
        </span>
        <span className="font-mono text-[11px] text-mono-dim">full feed</span>
      </div>
      <div className="py-6 text-center">
        <div className="font-serif text-[44px] leading-none text-gold">$0.005</div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.1em] text-mono-dim">USDC · ONE READ</div>
      </div>
      <span className="font-mono text-[11px] text-ash transition-colors group-hover:text-gold">
        see the full loop ↗
      </span>
    </Link>
  )
}

export function FeedPreview({ initialItems }: { initialItems: PreviewItem[] }) {
  const { data: items = [] } = useQuery<PreviewItem[]>({
    queryKey: ["feed-preview"],
    queryFn: async () => {
      const r = await fetch("/api/v1/feeds/preview")
      if (!r.ok) throw new Error("preview fetch failed")
      return (await r.json()).items as PreviewItem[]
    },
    initialData: initialItems,
    refetchInterval: 30_000,
  })

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-panel p-10 text-center">
        <p className="font-serif text-2xl text-marble">Next synthesis cycle pending.</p>
        <p className="mt-2 font-mono text-[12px] text-ash">
          The Triad publishes over the top macro &amp; crypto markets every ~10 minutes.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.slice(0, 3).map((item) => (
        <PreviewCard key={item.id} item={item} />
      ))}
      <LockedCard />
    </div>
  )
}
