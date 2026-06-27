import Link from "next/link"
import { getPreviewItems } from "@/lib/preview"
import { paymentTerms } from "@/lib/x402"
import { FeedPreview } from "@/components/feed-preview"
import { CodeBlock } from "@/components/code-block"
import { TriadMark } from "@/components/triad-mark"

export const dynamic = "force-dynamic"

const GITHUB = "https://github.com/Manuel-dev01/Stoa"

const TRIAD = [
  {
    name: "The Quantec",
    role: "Structural",
    body: "Reasons from order-book depth, funding rates, and macro actuals. Keeps an episodic memory of historical regime loops. Ignores narrative.",
  },
  {
    name: "The Bayesian",
    role: "Time-series",
    body: "Technical and sentiment analysis, conditioned on a rolling pgvector memory of prompt→outcome states retrieved by similarity.",
  },
  {
    name: "The Calibrator",
    role: "Metacognitive",
    body: "Reads each agent's historical error log, penalizes whichever was wrong before, reconciles the two reads, and sizes the stake with fractional Kelly.",
  },
]

const NOT = [
  "A trading platform or advisor",
  "A persona marketplace",
  "Builder fees or a fee rail",
  "A token",
  '"Six AI personalities"',
]

const BOT_SNIPPET = `import os, requests
from web3 import Web3

FEED = "https://<your-stoa-domain>/api/v1/feeds/macro-alpha"
w3 = Web3(Web3.HTTPProvider(os.environ["ARC_RPC"]))
acct = w3.eth.account.from_key(os.environ["BOT_PRIVATE_KEY"])

resp = requests.get(FEED)
if resp.status_code == 402:                      # 402 Payment Required
    t = resp.json()["payment_terms"]             # 0.005 USDC on Arc
    usdc = w3.eth.contract(address=ARC_USDC, abi=ERC20)
    tx = usdc.functions.transfer(t["pay_to"], 5000).transact({"from": acct.address})
    receipt = "0x" + w3.eth.wait_for_transaction_receipt(tx)["transactionHash"].hex()
    resp = requests.get(FEED, headers={"X-402-Payment-Receipt": receipt})

for item in resp.json()["items"]:                # unlocked
    s = item["_stoa"]
    print(s["rating"], s["confidence_bps"], s["kelly_fraction"], s["irys_hash"])`

export default async function Home() {
  const items = await getPreviewItems(3)
  const terms = paymentTerms()

  return (
    <div className="bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(200,164,93,0.05),transparent_60%)]">
      <div className="mx-auto max-w-[1180px] px-6 pb-24 sm:px-12">
        {/* MASTHEAD */}
        <section className="mt-12 grid items-stretch gap-0 overflow-hidden rounded-lg border border-hairline bg-[#0C0B09] lg:grid-cols-[1.5fr_1fr]">
          <div className="border-hairline-soft p-10 sm:p-12 lg:border-r">
            <div className="mb-7 font-mono text-[11px] tracking-[0.24em] text-verdigris">
              ΣΤΟΑ &nbsp;·&nbsp; AN x402-GATED FEED
            </div>
            <h1 className="font-serif text-[clamp(44px,6.5vw,82px)] font-medium leading-[0.95] tracking-tight">
              A colonnade
              <br />
              for machines.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[16px] leading-relaxed text-ash">
              Three persistent-memory agents reason over the top macro &amp; crypto markets and
              emit one cross-calibrated synthesis each — with a fractional-Kelly stake and an
              immutable Irys trace. The feed is gated by a sub-cent USDC toll on Arc. The trace is
              the product, and machines pay for it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/flow"
                className="rounded-md bg-gold px-5 py-2.5 font-mono text-[12px] font-medium text-obsidian transition-opacity hover:opacity-90"
              >
                READ THE FEED
              </Link>
              <Link
                href="/traces"
                className="rounded-md border border-hairline px-5 py-2.5 font-mono text-[12px] text-ash transition-colors hover:text-marble"
              >
                VERIFY A TRACE
              </Link>
            </div>
          </div>
          <div className="relative min-h-[300px] overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(200,164,93,0.16),transparent_62%)]">
            <svg
              viewBox="0 0 400 400"
              className="absolute left-1/2 top-1/2 h-auto w-[115%] -translate-x-1/2 -translate-y-1/2"
            >
              <circle cx="200" cy="200" r="190" stroke="#1E1B16" strokeWidth="1" fill="none" />
              <g className="origin-center animate-spin-slow [transform-box:fill-box]">
                <circle
                  cx="200"
                  cy="200"
                  r="172"
                  stroke="#2A2620"
                  strokeWidth="0.7"
                  strokeDasharray="1.4 7"
                  fill="none"
                />
              </g>
              <circle cx="200" cy="200" r="140" stroke="rgba(200,164,93,0.16)" strokeWidth="0.7" fill="none" />
            </svg>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [filter:drop-shadow(0_0_22px_rgba(200,164,93,0.5))]">
              <TriadMark size={140} />
            </div>
          </div>
        </section>

        {/* THESIS */}
        <section className="mt-6 rounded-lg border border-hairline bg-panel p-8 sm:p-10">
          <h2 className="font-serif text-[28px] italic text-gold">
            One engine. One toll. One verifiable trace.
          </h2>
          <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-ash">
            Quant developers need clean, structured market reasoning, but LLM keys are expensive and
            subscriptions are friction. Stoa is the middleware: an RSSHub-compatible feed gated by
            HTTP 402. No receipt header, you get a 402 with payment terms; pay ~$0.005 USDC to the
            Treasury on Arc, retry with the tx hash, and the feed unlocks. Receipts are single-use
            and verified on-chain.
          </p>
        </section>

        {/* LIVE PREVIEW */}
        <section className="mt-16">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-verdigris">
              LIVE · LATEST SYNTHESES
            </h2>
            <span className="hidden font-mono text-[11px] text-mono-dim sm:inline">
              the numbers are free · the reasoning is the toll
            </span>
          </div>
          <FeedPreview initialItems={items} />
        </section>

        {/* THE TRIAD */}
        <section className="mt-16">
          <div className="mb-6 flex items-center gap-4">
            <TriadMark size={34} />
            <h2 className="font-serif text-[34px] leading-none">The Triad</h2>
          </div>
          <p className="mb-6 max-w-[64ch] text-[15px] leading-relaxed text-ash">
            Three verdigris nodes converge along structural lines into a single gold node — the
            synthesis the machine pays for. Three architecturally distinct, persistent-memory
            engines. Exactly three. No catalog, no personas.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {TRIAD.map((a) => (
              <div key={a.name} className="rounded-lg border border-hairline bg-panel p-6">
                <div className="mb-1 font-mono text-[11px] tracking-[0.14em] text-verdigris">
                  {a.role.toUpperCase()}
                </div>
                <div className="mb-3 font-serif text-[24px]">{a.name}</div>
                <p className="text-[14px] leading-relaxed text-ash">{a.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW THE TOLL WORKS */}
        <section className="mt-16 rounded-lg border border-hairline bg-panel p-8 sm:p-10">
          <h2 className="font-serif text-[30px]">How the toll works</h2>
          <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
            <span className="text-ash">REQUEST</span>
            <span className="text-mono-faint">→</span>
            <span className="text-gold">402 · {terms.amount} USDC</span>
            <span className="text-mono-faint">→</span>
            <span className="text-ash">PAY ON ARC</span>
            <span className="text-mono-faint">→</span>
            <span className="text-verdigris">200 · UNLOCKED</span>
          </div>
          <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
            {[
              ["RAIL", "x402"],
              ["CHAIN", "Circle · Arc"],
              ["PAY-TO", `${terms.pay_to.slice(0, 10)}…${terms.pay_to.slice(-4)}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between bg-panel px-4 py-3 font-mono text-[11.5px]">
                <span className="text-mono-dim">{k}</span>
                <span className="text-marble">{v}</span>
              </div>
            ))}
          </div>
          <Link
            href="/flow"
            className="mt-6 inline-block font-mono text-[12px] text-ash transition-colors hover:text-gold"
          >
            see the full loop, step by step ↗
          </Link>
        </section>

        {/* BRING YOUR OWN BOT */}
        <section className="mt-16">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-serif text-[30px]">Bring your own bot</h2>
            <span className="hidden font-mono text-[11px] text-mono-dim sm:inline">
              ~20 lines · no key, no login
            </span>
          </div>
          <CodeBlock code={BOT_SNIPPET} label="consume_feed.py" />
        </section>

        {/* WHAT STOA IS NOT */}
        <section className="mt-16 rounded-lg border border-gold/20 bg-[#0C0B09] p-8 sm:p-10">
          <div className="mb-5 font-mono text-[11px] tracking-[0.16em] text-gold">
            WHAT STOA IS NOT
          </div>
          <div className="flex flex-col gap-3">
            {NOT.map((n) => (
              <div key={n} className="flex items-center gap-3 text-[15px] text-ash">
                <span className="font-mono text-mono-dim">✕</span> {n}
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-hairline-soft pt-5 font-serif text-[19px] italic text-gold">
            One engine. One toll. One verifiable trace.
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-hairline-soft pt-8 font-mono text-[11px] tracking-[0.08em] text-mono-faint">
          <span className="text-mono-dim">STOA · ΣΤΟΑ</span>
          <div className="flex items-center gap-5">
            <span className="hidden sm:inline">
              <span className="text-gold">gold</span> = money ·{" "}
              <span className="text-verdigris">verdigris</span> = the machine
            </span>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="text-ash hover:text-marble">
              GITHUB ↗
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
