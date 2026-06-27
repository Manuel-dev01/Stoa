"use client"

import { useState } from "react"
import { TriadMark } from "@/components/triad-mark"
import type { TriadStats } from "@/lib/preview"

// Static brand copy for each architect (from Stoa Landing.dc.html). The live
// numbers (TRACES / AVG CONF / LATEST) come from the `stats` prop — hit-rate and
// edge aren't computed, so they're not shown.
const ARCHITECTS = [
  {
    key: "quantec" as const,
    name: "Quantec",
    discipline: "STRUCTURAL MARKET ANALYST",
    engine: "The Lattice Engine",
    greekUpper: "ΔΟΜΗ",
    greekTitle: "Δομή",
    desc: "Decomposes a market into its structural drivers — supply, positioning, regime — and maps the skeleton the others reason over.",
    maxim: "Find the frame before you weigh the odds.",
    method: "structural",
    accent: "#5FA391",
  },
  {
    key: "bayesian" as const,
    name: "Bayesian",
    discipline: "TIME-SERIES PROBABILITY ENGINE",
    engine: "The Posterior Engine",
    greekUpper: "ΕΙΚΟΣ",
    greekTitle: "Εἰκός",
    desc: "Holds a running posterior. Updates probability as evidence lands, weighting history against the present without overfitting noise.",
    maxim: "Hold every belief at the strength the evidence earns.",
    method: "time-series",
    accent: "#5FA391",
  },
  {
    key: "calibrator" as const,
    name: "Calibrator",
    discipline: "METACOGNITIVE CALIBRATION LAYER",
    engine: "The Apatheia Engine",
    greekUpper: "ΛΟΓΟΣ",
    greekTitle: "Λόγος",
    desc: "Sits above the other two. Scores their track record and penalizes prior-wrong agents before they speak — the rigor, not the confidence.",
    maxim: "Trust the one who has been right; discount the one who has not.",
    method: "meta",
    accent: "#C8A45D",
  },
]

const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"]
const ROMAN_POS = [
  [200, 35], [282.5, 57.1], [342.9, 117.5], [365, 200], [342.9, 282.5], [282.5, 342.9],
  [200, 365], [117.5, 342.9], [57.1, 282.5], [35, 200], [57.1, 117.5], [117.5, 57.1],
]

function ago(iso: string | null): string {
  if (!iso) return "—"
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-obsidian px-4 py-[18px]">
      <div className="mb-[7px] font-mono text-[9.5px] tracking-[0.1em] text-mono-dim">{label}</div>
      <div className="font-serif text-[27px]" style={{ color: color ?? "#E9E3D6" }}>
        {value}
      </div>
    </div>
  )
}

export function TriadExplorer({ stats }: { stats: TriadStats }) {
  const [active, setActive] = useState(2)
  const a = ARCHITECTS[active]
  const s = stats[a.key]
  const conf = s.avgConfidenceBps != null ? `${Math.round(s.avgConfidenceBps / 100)}%` : "—"
  const tracesFmt = s.traces.toLocaleString()

  return (
    <>
      {/* FEATURED ARCHITECT */}
      <div className="grid overflow-hidden rounded-lg border border-hairline bg-[#0A0908] shadow-[0_50px_110px_-60px_rgba(0,0,0,0.95)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* DIAL */}
        <div className="relative min-h-[540px] overflow-hidden border-hairline-soft bg-[radial-gradient(circle_at_50%_46%,rgba(200,164,93,0.16),rgba(8,7,6,0)_58%)] md:border-r">
          <div className="absolute left-6 right-6 top-[22px] z-[3] flex justify-between font-mono text-[10.5px] tracking-[0.14em]">
            <span className="text-mono-dim">
              ARCHITECT&nbsp;·&nbsp;<span className="text-gold">{a.name}</span>
            </span>
            <span className="text-right leading-[1.7] text-mono-dim">
              CONF <span className="text-gold">{conf}</span>
              <br />
              LATEST <span className="text-verdigris">{ago(s.latestAt)}</span>
            </span>
          </div>

          <svg
            viewBox="0 0 400 400"
            className="absolute left-1/2 top-1/2 h-auto w-[90%] max-w-[460px] -translate-x-1/2 -translate-y-[52%]"
          >
            <circle cx="200" cy="200" r="192" stroke="#1E1B16" strokeWidth="1" fill="none" />
            <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "spin 120s linear infinite" }}>
              <circle cx="200" cy="200" r="178" stroke="#2A2620" strokeWidth="0.7" strokeDasharray="1.4 7" fill="none" />
            </g>
            <circle cx="200" cy="200" r="150" stroke="rgba(200,164,93,0.18)" strokeWidth="0.7" fill="none" />
            <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "spin 90s linear infinite reverse" }}>
              <circle cx="200" cy="200" r="120" stroke="#241F18" strokeWidth="0.7" strokeDasharray="1 15" fill="none" />
            </g>
            <circle cx="200" cy="200" r="96" stroke="rgba(200,164,93,0.13)" strokeWidth="0.7" fill="none" />
            <line x1="200" y1="8" x2="200" y2="392" stroke="#1A1712" strokeWidth="0.5" />
            <line x1="8" y1="200" x2="392" y2="200" stroke="#1A1712" strokeWidth="0.5" />
            <path d="M150 120 L186 158 L228 132 L268 170" stroke="rgba(200,164,93,0.22)" strokeWidth="0.6" fill="none" />
            <circle cx="150" cy="120" r="1.6" fill="rgba(233,227,214,0.5)" />
            <circle cx="186" cy="158" r="1.4" fill="rgba(233,227,214,0.4)" />
            <circle cx="228" cy="132" r="1.6" fill="rgba(233,227,214,0.5)" />
            <circle cx="268" cy="170" r="1.3" fill="rgba(233,227,214,0.35)" />
            <circle cx="120" cy="250" r="1.2" fill="rgba(233,227,214,0.3)" />
            <circle cx="290" cy="262" r="1.2" fill="rgba(233,227,214,0.3)" />
            <g
              fill="rgba(200,164,93,0.5)"
              fontFamily="var(--font-serif), serif"
              fontStyle="italic"
              fontSize="13"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {ROMAN.map((r, i) => (
                <text key={r} x={ROMAN_POS[i][0]} y={ROMAN_POS[i][1]}>
                  {r}
                </text>
              ))}
            </g>
          </svg>

          <div className="absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-[55%] [filter:drop-shadow(0_0_22px_rgba(200,164,93,0.45))]">
            <TriadMark size={172} withLines />
          </div>

          <div className="absolute bottom-[30px] left-0 right-0 z-[3] text-center">
            <div className="mb-1.5 font-mono text-[10px] tracking-[0.34em] text-mono-dim">{a.greekUpper}</div>
            <div className="font-serif text-[34px] italic text-gold">{a.greekTitle}</div>
          </div>
        </div>

        {/* DETAIL */}
        <div className="flex flex-col p-10 sm:p-11">
          <div className="mb-3.5 font-mono text-[11.5px] tracking-[0.18em] text-gold/80">{a.discipline}</div>
          <h3 className="mb-2 font-serif text-[clamp(48px,6vw,76px)] font-medium leading-[0.92] text-marble">
            {a.name}
          </h3>
          <div className="mb-6 font-serif text-[23px] italic text-ash">“{a.engine}”</div>
          <p className="m-0 max-w-[48ch] text-[16px] leading-[1.65] text-[#A39C8D]">{a.desc}</p>
          <div className="my-7 border-l-2 border-gold/60 pl-[18px] font-serif text-[21px] italic leading-[1.4] text-[#C9C2B2]">
            {a.maxim}
          </div>
          <div className="mt-auto grid grid-cols-4 gap-px overflow-hidden rounded-md border border-hairline bg-hairline-soft">
            <StatCell label="TRACES" value={tracesFmt} />
            <StatCell label="AVG CONF" value={conf} color="#5FA391" />
            <StatCell label="LATEST" value={ago(s.latestAt)} color="#C8A45D" />
            <div className="bg-obsidian px-4 py-[18px]">
              <div className="mb-[7px] font-mono text-[9.5px] tracking-[0.1em] text-mono-dim">METHOD</div>
              <div className="pt-[7px] font-mono text-[14px] text-marble">{a.method}</div>
            </div>
          </div>
        </div>
      </div>

      {/* SELECTOR */}
      <div className="my-[30px] mb-3.5 flex items-baseline justify-between font-mono text-[11px] tracking-[0.16em] text-mono-dim">
        <span>THE TRIAD</span>
        <span>SELECT AN ARCHITECT ↓</span>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {ARCHITECTS.map((arc, i) => {
          const isActive = i === active
          const isGold = arc.key === "calibrator"
          const ring = isActive
            ? isGold
              ? "border-gold/55 bg-gold/[0.07]"
              : "border-verdigris/50 bg-verdigris/5"
            : "border-hairline bg-obsidian"
          return (
            <button
              key={arc.key}
              onClick={() => setActive(i)}
              className={`flex items-center gap-3.5 rounded-md border px-[18px] py-4 text-left transition-colors ${ring}`}
            >
              <div
                className="h-[30px] w-[30px] flex-none rounded-full border"
                style={{
                  borderColor: arc.accent,
                  background: `radial-gradient(circle at 50% 40%, ${isGold ? "rgba(200,164,93,0.5)" : "rgba(95,163,145,0.45)"}, transparent 70%)`,
                }}
              />
              <div>
                <div className="font-serif text-[21px] leading-none text-marble">{arc.name}</div>
                <div
                  className="mt-[3px] font-mono text-[10px] tracking-[0.1em]"
                  style={{ color: arc.accent }}
                >
                  {arc.greekTitle}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* CONVERGENCE */}
      <div className="mt-6 flex items-center gap-[18px] rounded-md border border-hairline bg-panel px-[26px] py-[22px]">
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none" className="flex-none">
          <circle cx="8" cy="10" r="2.4" fill="#5FA391" />
          <circle cx="8" cy="22" r="2.4" fill="#5FA391" />
          <circle cx="8" cy="16" r="2.4" fill="#C8A45D" />
          <circle cx="26" cy="16" r="3.2" fill="#C8A45D" />
          <path d="M8 10 L26 16 M8 22 L26 16 M8 16 L26 16" stroke="#3A352B" strokeWidth="1.1" />
        </svg>
        <div className="text-[15px] leading-[1.55] text-ash">
          <span className="font-serif text-[20px] italic text-marble">Cross-calibrated.</span>{" "}
          The three reconcile into a single, weighted synthesis per market — one rigorous answer, not
          three opinions.
        </div>
      </div>
    </>
  )
}
