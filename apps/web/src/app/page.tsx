import Link from "next/link"
import { getPreviewItems, getTriadStats } from "@/lib/preview"
import { TriadMark } from "@/components/triad-mark"
import { TriadExplorer } from "@/components/triad-explorer"
import { GITHUB_URL } from "@/lib/site"
import { shortHash } from "@/lib/format"

export const dynamic = "force-dynamic"

const FEED_PATH = "/api/v1/feeds/macro-alpha"

// --- Hero handshake card ---------------------------------------------------

function HandshakeRow({
  code,
  codeColor,
  text,
  sub,
  dotColor,
  delay,
}: {
  code: string
  codeColor: string
  text: string
  sub?: string
  dotColor: string
  delay: number
}) {
  return (
    <div
      className="mx-2 my-1.5 flex items-center gap-3.5 rounded-[3px] border border-hairline px-4 py-[13px]"
      style={{ animation: `stepPulse 6.4s infinite`, animationDelay: `${delay}s` }}
    >
      <span className="w-[34px] font-mono text-[11px]" style={{ color: codeColor }}>
        {code}
      </span>
      <span className="flex-1 font-mono text-[12.5px] text-marble">
        {text}
        {sub && <span className="text-mono-dim"> {sub}</span>}
      </span>
      <span
        className="h-[7px] w-[7px] rounded-full"
        style={{ background: dotColor, animation: `stepDot 6.4s infinite`, animationDelay: `${delay}s` }}
      />
    </div>
  )
}

// --- Thesis flow cell ------------------------------------------------------

function FlowCell({
  label,
  labelColor,
  title,
  body,
  bg,
}: {
  label: string
  labelColor: string
  title: string
  body: string
  bg?: string
}) {
  return (
    <div className="min-w-[160px] flex-1 px-6 py-[26px]" style={bg ? { background: bg } : undefined}>
      <div className="mb-3 font-mono text-[11px]" style={{ color: labelColor }}>
        {label}
      </div>
      <div className="mb-2 font-serif text-[25px] text-marble">{title}</div>
      <div className="text-[13.5px] leading-[1.5] text-[#7C7567]">{body}</div>
    </div>
  )
}

// --- TRACE: real latest item as colorized JSON -----------------------------

function K({ children }: { children: React.ReactNode }) {
  return <span className="text-ash">{children}</span>
}

function TraceJson({ item }: { item: Awaited<ReturnType<typeof getPreviewItems>>[number] | undefined }) {
  const irys = item?.irys_hash ? `https://gateway.irys.xyz/${item.irys_hash}` : null
  const arc = item?.arc_tx_hash ? `https://testnet.arcscan.app/tx/${item.arc_tx_hash}` : null
  return (
    <pre className="m-0 overflow-x-auto px-[22px] py-6 font-mono text-[13px] leading-[1.85] text-ash">
      <span className="text-mono-faint">{"{"}</span>
      {"\n  "}
      <K>&quot;market&quot;</K>: <span className="text-marble">&quot;{item ? item.question : "—"}&quot;</span>,
      {"\n  "}
      <K>&quot;venue&quot;</K>: <span className="text-marble">&quot;{item ? item.venue : "—"}&quot;</span>,
      {"\n  "}
      <K>&quot;synthesis&quot;</K>: <span className="text-mono-faint">{"{"}</span>
      {"\n    "}
      <K>&quot;rating&quot;</K>: <span className="text-verdigris">{item ? item.rating : "—"}</span>,
      {"\n    "}
      <K>&quot;confidence_bps&quot;</K>: <span className="text-verdigris">{item ? item.confidence_bps : "—"}</span>,
      {"\n    "}
      <K>&quot;kelly_fraction&quot;</K>: <span className="text-gold">{item ? item.kelly_fraction : "—"}</span>
      {"\n  "}
      <span className="text-mono-faint">{"}"}</span>,
      {"\n  "}
      <K>&quot;trace&quot;</K>: <span className="text-mono-faint">{"{"}</span>
      {"\n    "}
      <K>&quot;irys&quot;</K>:{" "}
      {irys ? (
        <a href={irys} target="_blank" rel="noreferrer" className="text-marble underline decoration-hairline underline-offset-2 hover:text-verdigris">
          &quot;{shortHash(item!.irys_hash, 6, 4)}&quot;
        </a>
      ) : (
        <span className="text-marble">&quot;—&quot;</span>
      )}
      ,
      {"\n    "}
      <K>&quot;arc&quot;</K>:{" "}
      {arc ? (
        <a href={arc} target="_blank" rel="noreferrer" className="text-marble underline decoration-hairline underline-offset-2 hover:text-verdigris">
          &quot;{shortHash(item!.arc_tx_hash, 6, 4)}&quot;
        </a>
      ) : (
        <span className="text-marble">&quot;—&quot;</span>
      )}
      ,
      {"\n    "}
      <K>&quot;sha256&quot;</K>: <span className="text-marble">&quot;{item ? shortHash(item.trace_hash, 6, 4) : "—"}&quot;</span>
      {"\n  "}
      <span className="text-mono-faint">{"}"}</span>
      {"\n"}
      <span className="text-mono-faint">{"}"}</span>
    </pre>
  )
}

// --- Page ------------------------------------------------------------------

export default async function Home() {
  const [items, triadStats] = await Promise.all([getPreviewItems(1), getTriadStats()])
  const latest = items[0]

  return (
    <div className="overflow-x-hidden bg-obsidian">
      {/* HERO */}
      <header className="relative flex min-h-[92vh] flex-col justify-center overflow-hidden px-6 pb-16 pt-20 sm:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-90" style={{ perspective: "600px" }}>
          <div
            className="absolute inset-x-[-5%] bottom-0 top-[-10%]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 92px, rgba(233,227,214,0.045) 92px 94px)",
              transform: "rotateX(34deg) scale(1.6)",
              transformOrigin: "center 80%",
              WebkitMaskImage: "radial-gradient(120% 80% at 50% 18%, #000 10%, transparent 72%)",
              maskImage: "radial-gradient(120% 80% at 50% 18%, #000 10%, transparent 72%)",
            }}
          />
          <div
            className="absolute bottom-0 top-0 w-[42%]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(200,164,93,0.05), transparent)",
              animation: "sweep 16s linear infinite",
            }}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(80% 55% at 50% 30%, transparent 40%, rgba(12,11,9,0.7) 100%)" }}
        />

        <div className="relative mx-auto w-full max-w-[1180px]">
          <div className="mb-7 font-mono text-[12px] tracking-[0.34em] text-verdigris">
            ΣΤΟΑ &nbsp;·&nbsp; MACHINE‑PAYABLE MARKET REASONING
          </div>
          <h1 className="m-0 max-w-[14ch] font-serif text-[clamp(48px,8.2vw,116px)] font-medium leading-[0.96] tracking-tight text-marble">
            The trace is the product.
            <br />
            And{" "}
            <span
              className="italic"
              style={{
                backgroundImage: "linear-gradient(90deg,#C8A45D,#E0C079,#C8A45D)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: "goldShimmer 6s linear infinite",
              }}
            >
              machines pay
            </span>{" "}
            for it.
          </h1>
          <div className="mt-12 flex flex-wrap items-end gap-12">
            <p className="m-0 max-w-[46ch] text-[17px] leading-[1.6] text-ash">
              A machine-readable feed of cross-calibrated macro &amp; crypto market reasoning. Gated
              behind an HTTP&nbsp;402 toll — a bot hits the endpoint, autonomously pays a sub‑cent USDC
              nanopayment on Arc, and unlocks the feed in under 500ms.
            </p>
            <div
              className="relative min-w-[320px] max-w-[440px] flex-1 rounded-[4px] border border-hairline bg-panel shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
              style={{ animation: "floatY 7s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 border-b border-hairline-soft px-3.5 py-[11px]">
                <span className="h-2 w-2 rounded-full bg-verdigris" style={{ animation: "livePulse 2.4s infinite" }} />
                <span className="font-mono text-[11px] tracking-[0.12em] text-mono-dim">x402 handshake</span>
                <span className="ml-auto font-mono text-[11px] text-mono-dim">arc · usdc</span>
              </div>
              <div className="py-1.5">
                <HandshakeRow code="GET" codeColor="#9A9384" text={FEED_PATH} dotColor="#9A9384" delay={0} />
                <HandshakeRow code="402" codeColor="#C8A45D" text="Payment Required" sub="· 0.005 USDC" dotColor="#C8A45D" delay={1.6} />
                <HandshakeRow code="PAY" codeColor="#9A9384" text="settle" sub="· <500ms · Treasury" dotColor="#9A9384" delay={3.2} />
                <HandshakeRow code="200" codeColor="#5FA391" text="feed unlocked" sub="· trace ↓" dotColor="#5FA391" delay={4.8} />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-[26px] left-1/2 -translate-x-1/2 font-mono text-[10.5px] tracking-[0.3em] text-mono-faint">
          SCROLL ↓ THE PORCH WHERE MACHINES READ
        </div>
      </header>

      {/* 01 THESIS */}
      <section id="thesis" className="relative border-t border-[#161310] px-6 py-[120px] sm:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-[34px] flex items-baseline gap-[18px] font-mono text-[12px] tracking-[0.2em] text-verdigris">
            <span className="text-gold">01</span>
            <span className="h-px max-w-[80px] flex-1 bg-hairline" />
            <span>THE THESIS</span>
          </div>
          <h2 className="m-0 mb-7 max-w-[18ch] font-serif text-[clamp(34px,5vw,64px)] font-medium leading-[1.02] tracking-tight">
            It intercepts the open feed. Then it charges admission.
          </h2>
          <p className="m-0 mb-[70px] max-w-[60ch] text-[17px] leading-[1.65] text-ash">
            Quant developers already aggregate market data through the open-source feed ecosystem.
            Stoa is the missing middleware — a premium upstream route that wraps clean, structured
            market reasoning and meters it per request. No marketplace to bootstrap. No cold-start
            liquidity. One defensible engine, one toll.
          </p>
          <div className="flex flex-wrap items-stretch overflow-hidden rounded-[5px] border border-hairline bg-panel">
            <FlowCell label="SOURCE" labelColor="#6B655A" title="The bot" body="Aggregates feeds via RSSHub. Wants signal, not prose." />
            <div className="flex items-center px-1 font-mono text-mono-faint">→</div>
            <FlowCell label="UPSTREAM" labelColor="#5FA391" title="Stoa route" body="Premium upstream wraps the Triad's synthesis into the feed." bg="rgba(95,163,145,0.04)" />
            <div className="flex items-center px-1 font-mono text-mono-faint">→</div>
            <FlowCell label="402 GATE" labelColor="#C8A45D" title="The toll" body="≈$0.005 USDC. Paid autonomously on Arc via x402." bg="rgba(200,164,93,0.05)" />
            <div className="flex items-center px-1 font-mono text-mono-faint">→</div>
            <FlowCell label="UNLOCK" labelColor="#6B655A" title="The trace" body="Verifiable synthesis delivered. Settled in <500ms." />
          </div>
          <div className="mt-px grid grid-cols-1 gap-px border border-hairline border-t-0 bg-hairline-soft sm:grid-cols-3">
            {[
              ["No subscription", "PAY PER REQUEST, NOT PER MONTH"],
              ["No API key", "THE WALLET IS THE CREDENTIAL"],
              ["No friction", "20 LINES OF CLIENT CODE"],
            ].map(([t, s]) => (
              <div key={t} className="bg-obsidian px-6 py-[30px]">
                <div className="mb-1.5 font-serif text-[30px] italic text-gold">{t}</div>
                <div className="font-mono text-[11.5px] tracking-[0.05em] text-mono-dim">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 02 TRIAD */}
      <section
        id="triad"
        className="relative border-t border-[#161310] bg-gradient-to-b from-obsidian to-[#0A0908] px-6 py-[120px] sm:px-10"
      >
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-[34px] flex items-baseline gap-[18px] font-mono text-[12px] tracking-[0.2em] text-verdigris">
            <span className="text-gold">02</span>
            <span className="h-px w-20 bg-hairline" />
            <span>THE TRIAD</span>
          </div>
          <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
            <h2 className="m-0 max-w-[16ch] font-serif text-[clamp(34px,5vw,64px)] font-medium leading-[1.02] tracking-tight">
              Three architects. One synthesis per market.
            </h2>
            <p className="m-0 max-w-[38ch] text-[15.5px] leading-[1.6] text-ash">
              Not a prompt with three names. Three architecturally distinct, persistent-memory engines
              that argue, then reconcile — each a calibrated instrument of its own discipline.
            </p>
          </div>
          <TriadExplorer stats={triadStats} />
        </div>
      </section>

      {/* 03 TRACE */}
      <section id="trace" className="relative border-t border-[#161310] px-6 py-[120px] sm:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-[34px] flex items-baseline gap-[18px] font-mono text-[12px] tracking-[0.2em] text-verdigris">
            <span className="text-gold">03</span>
            <span className="h-px w-20 bg-hairline" />
            <span>THE TRACE</span>
          </div>
          <div className="grid items-start gap-14 md:grid-cols-[1fr_1.15fr]">
            <div>
              <h2 className="m-0 mb-6 max-w-[14ch] font-serif text-[clamp(32px,4.4vw,56px)] font-medium leading-[1.04] tracking-tight">
                Verify the reasoning by hash.
              </h2>
              <p className="m-0 mb-10 max-w-[46ch] text-[16px] leading-[1.65] text-ash">
                Every item is canonicalized, hashed, pinned to Irys, and anchored on Arc. To a
                skeptical quant this is the whole trust property: the synthesis isn&apos;t a newsletter
                you take on faith — it&apos;s data infrastructure you can check.
              </p>
              <div className="flex flex-col border-l border-hairline">
                {[
                  ["01 · CANONICALIZE", "Deterministic serialization. Same reasoning, same bytes, every time.", "#5FA391"],
                  ["02 · SHA‑256", "An immutable fingerprint of the exact synthesis.", "#5FA391"],
                  ["03 · IRYS PIN", "Permanently stored, content-addressed, retrievable forever.", "#5FA391"],
                  ["04 · ARC ANCHOR", "The hash is committed on-chain. Now it's tamper-evident.", "#C8A45D"],
                ].map(([label, body, color], i, arr) => (
                  <div key={label} className={`relative pl-[22px] ${i < arr.length - 1 ? "pb-[26px]" : "pb-0.5"}`}>
                    <span className="absolute left-[-5px] top-[3px] h-[9px] w-[9px] rounded-full" style={{ background: color }} />
                    <div className="mb-[5px] font-mono text-[11px] tracking-[0.1em]" style={{ color }}>
                      {label}
                    </div>
                    <div className="text-[13.5px] leading-[1.5] text-[#8A8375]">{body}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-hairline bg-[#0A0908] shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]">
              <div className="flex items-center gap-2.5 border-b border-hairline-soft bg-panel px-[18px] py-[13px]">
                <span className="h-2 w-2 rounded-full bg-gold" />
                <span className="font-mono text-[11.5px] tracking-[0.06em] text-ash">
                  GET {FEED_PATH} · 200 OK
                </span>
                <span className="ml-auto font-mono text-[11px] text-verdigris">application/json</span>
              </div>
              <TraceJson item={latest} />
            </div>
          </div>
        </div>
      </section>

      {/* EXPLORE */}
      <section className="relative border-t border-[#161310] bg-gradient-to-b from-[#0A0908] to-obsidian px-6 py-[100px] sm:px-10">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[22px] md:grid-cols-2">
          <Link href="/flow" className="block rounded-lg border border-hairline bg-panel px-9 py-[38px] transition-colors hover:border-verdigris/40">
            <div className="mb-4 font-mono text-[11px] tracking-[0.16em] text-verdigris">THE PRODUCT ↗</div>
            <div className="mb-2.5 font-serif text-[34px] text-marble">Walk the full app flow</div>
            <div className="text-[14.5px] leading-[1.6] text-[#8A8375]">
              Six screens, locked endpoint to verified trace — the entire loop a bot runs.
            </div>
          </Link>
          <Link href="/traces" className="block rounded-lg border border-hairline bg-panel px-9 py-[38px] transition-colors hover:border-gold/40">
            <div className="mb-4 font-mono text-[11px] tracking-[0.16em] text-gold">THE PROOF ↗</div>
            <div className="mb-2.5 font-serif text-[34px] text-marble">Verify any trace</div>
            <div className="text-[14.5px] leading-[1.6] text-[#8A8375]">
              Every published synthesis, hashed and anchored. Open one and check it yourself.
            </div>
          </Link>
        </div>
      </section>

      {/* CLOSING */}
      <footer className="relative overflow-hidden border-t border-[#161310] px-6 pb-[70px] pt-[130px] text-center sm:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ perspective: "600px" }}>
          <div
            className="absolute inset-x-[-5%] bottom-0 top-[-10%]"
            style={{
              backgroundImage: "repeating-linear-gradient(90deg, transparent 0 92px, rgba(233,227,214,0.04) 92px 94px)",
              transform: "rotateX(40deg) scale(1.7)",
              transformOrigin: "center 60%",
              WebkitMaskImage: "radial-gradient(110% 70% at 50% 30%, #000 5%, transparent 70%)",
              maskImage: "radial-gradient(110% 70% at 50% 30%, #000 5%, transparent 70%)",
            }}
          />
        </div>
        <div className="relative mx-auto max-w-[880px]">
          <div className="mb-[34px] flex justify-center">
            <TriadMark size={40} />
          </div>
          <h2 className="m-0 mb-[30px] font-serif text-[clamp(36px,6vw,78px)] font-medium leading-none tracking-tight">
            The trace is the product.
            <br />
            And <span className="italic text-gold">machines pay</span> for it.
          </h2>
          <div className="inline-flex items-center gap-3 rounded-[4px] border border-hairline bg-panel px-[18px] py-[11px] font-mono text-[13px] text-ash">
            <span className="h-1.5 w-1.5 rounded-full bg-verdigris" style={{ animation: "livePulse 2.4s infinite" }} />
            GET {FEED_PATH}
            <span className="text-gold">→ 402</span>
          </div>
        </div>
        <div className="relative mx-auto mt-20 flex max-w-[1180px] flex-wrap justify-between gap-4 border-t border-[#161310] pt-[26px] font-mono text-[11px] tracking-[0.08em] text-mono-faint">
          <span className="text-mono-dim">STOA · ΣΤΟΑ</span>
          <span className="hidden sm:inline">MACHINE-PAYABLE MARKET REASONING · x402 · ARC · IRYS</span>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-ash hover:text-marble">
            GITHUB ↗
          </a>
        </div>
      </footer>
    </div>
  )
}
