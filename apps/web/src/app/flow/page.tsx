import Link from "next/link"
import { getPreviewItems, getLatestReceipt } from "@/lib/preview"
import { paymentTerms } from "@/lib/x402"
import { stanceWord, confidencePct, shortHash, irysUrl } from "@/lib/format"
import { CodeTabs } from "@/components/code-tabs"
import { FEED_URL } from "@/lib/site"

export const dynamic = "force-dynamic"

const STEPS = ["DISCOVER", "REQUEST", "THE TOLL", "SETTLE", "UNLOCKED", "SYNTHESIS"]

const TRIAD_ORDER = ["quantec", "bayesian", "calibrator"] as const
const AGENT_LABEL: Record<string, string> = {
  quantec: "QUANTEC",
  bayesian: "BAYESIAN",
  calibrator: "CALIBR.",
}

function StepHead({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-serif text-[36px] leading-none text-gold">{n}</span>
      <span className="font-mono text-[12px] tracking-[0.14em] text-ash">{label}</span>
    </div>
  )
}

function Frame({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={`flex h-[500px] flex-col overflow-hidden rounded-lg border bg-panel ${
        accent ? "border-gold/30" : "border-hairline"
      }`}
    >
      {children}
    </div>
  )
}

function Bar({ children, dot }: { children: React.ReactNode; dot: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline-soft px-[14px] py-[11px]">
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: dot }} />
      <span className="font-mono text-[11px] text-mono-dim">{children}</span>
    </div>
  )
}

export default async function FlowPage() {
  const [items, terms, receipt] = await Promise.all([
    getPreviewItems(3),
    Promise.resolve(paymentTerms()),
    getLatestReceipt(),
  ])
  const lead = items[0]
  const txShort = receipt ? shortHash(receipt.tx_hash, 6, 3) : "0xa3f…d20"
  const discoverList: { question: string; venue: string }[] = items.length
    ? items.map((it) => ({ question: it.question, venue: it.venue }))
    : placeholderMarkets.map((q) => ({ question: q, venue: "polymarket" }))

  return (
    <div className="mx-auto max-w-[1180px] px-6 pb-20 pt-16 sm:px-12">
      {/* INTRO */}
      <div className="mb-8 flex items-baseline gap-[18px] font-mono text-[12px] tracking-[0.2em] text-verdigris">
        <span className="text-gold">THE PRODUCT</span>
        <span className="h-px w-20 bg-hairline" />
        <span>ONE LOOP · NO HUMAN</span>
      </div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-7">
        <h1 className="max-w-[15ch] font-serif text-[clamp(38px,5.5vw,72px)] font-medium leading-none tracking-tight">
          From locked endpoint to verified trace.
        </h1>
        <p className="max-w-[36ch] text-[15px] leading-relaxed text-ash">
          The entire loop a trading bot runs against Stoa — six steps, settled in under half a
          second. No login, no key, no human in the path.
        </p>
      </div>

      {/* LOOP SUMMARY */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-panel px-[22px] py-[18px] font-mono text-[11.5px] tracking-[0.04em]">
        <span className="text-ash">DISCOVER</span>
        <span className="text-mono-faint">→</span>
        <span className="text-ash">REQUEST</span>
        <span className="text-mono-faint">→</span>
        <span className="text-gold">402 TOLL</span>
        <span className="text-mono-faint">→</span>
        <span className="text-ash">SETTLE</span>
        <span className="text-mono-faint">→</span>
        <span className="text-verdigris">UNLOCKED</span>
        <span className="text-mono-faint">→</span>
        <span className="text-ash">SYNTHESIS</span>
        <span className="ml-auto text-mono-dim">≈ 412ms end-to-end</span>
      </div>

      {/* FILM STRIP */}
      <div className="-mx-6 flex snap-x snap-mandatory gap-[30px] overflow-x-auto px-6 py-10 sm:-mx-12 sm:px-12">
        {/* 1 DISCOVER */}
        <div className="flex w-[380px] flex-none snap-center flex-col gap-4">
          <StepHead n={1} label={STEPS[0]} />
          <Frame>
            <Bar dot="#5FA391">stoa · markets</Bar>
            <div className="flex-1 overflow-hidden p-4">
              <div className="mb-4 flex gap-2">
                <span className="rounded-full border border-verdigris/40 px-2.5 py-1 font-mono text-[10px] text-verdigris">
                  MACRO
                </span>
                <span className="rounded-full border border-hairline px-2.5 py-1 font-mono text-[10px] text-mono-dim">
                  CRYPTO
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {discoverList.slice(0, 3).map((m, i) => (
                  <div key={i} className="rounded border border-hairline bg-obsidian p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13.5px] leading-snug text-marble">{m.question}</span>
                      <span className="whitespace-nowrap rounded border border-gold/40 px-1.5 py-0.5 font-mono text-[9px] text-gold">
                        🔒 402
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[10.5px] text-mono-dim">
                      {m.venue} · macro/crypto
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Frame>
        </div>

        {/* 2 REQUEST */}
        <div className="flex w-[380px] flex-none snap-center flex-col gap-4">
          <StepHead n={2} label={STEPS[1]} />
          <Frame>
            <Bar dot="#6B655A">bot · shell</Bar>
            <div className="flex-1 p-4 font-mono text-[12px] leading-[1.9]">
              <div className="text-verdigris">$ curl /api/v1/feeds/macro-alpha</div>
              <div className="mt-3.5 text-mono-dim">
                &gt; HTTP/1.1 <span className="text-gold">402 Payment Required</span>
              </div>
              <div className="text-mono-dim">
                &gt; x-402-toll: <span className="text-marble">{terms.amount}</span>
              </div>
              <div className="text-mono-dim">
                &gt; x-402-asset: <span className="text-marble">{terms.asset}</span>
              </div>
              <div className="text-mono-dim">
                &gt; x-402-chain: <span className="text-marble">arc</span>
              </div>
              <div className="text-mono-dim">
                &gt; x-402-pay-to: <span className="text-marble">{shortHash(terms.pay_to, 6, 2)}</span>
              </div>
              <div className="mt-4 text-mono-faint"># no key. no login.</div>
              <div className="text-mono-faint"># the wallet answers.</div>
            </div>
          </Frame>
        </div>

        {/* 3 THE TOLL */}
        <div className="flex w-[380px] flex-none snap-center flex-col gap-4">
          <StepHead n={3} label={STEPS[2]} />
          <Frame accent>
            <Bar dot="#C8A45D">402 · payment required</Bar>
            <div className="flex flex-1 flex-col justify-center px-[22px] py-7 text-center">
              <div className="font-serif text-[66px] leading-none text-gold">${terms.amount}</div>
              <div className="mb-7 mt-1.5 font-mono text-[11px] tracking-[0.1em] text-mono-dim">
                USDC · ONE READ
              </div>
              <div className="flex flex-col gap-px overflow-hidden rounded-md border border-hairline bg-hairline text-left">
                {[
                  ["RAIL", "x402"],
                  ["CHAIN", "Circle · Arc"],
                  ["PAY-TO", "Stoa Treasury"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between bg-[#13100B] px-3.5 py-3 font-mono text-[11.5px]">
                    <span className="text-mono-dim">{k}</span>
                    <span className="text-marble">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Frame>
        </div>

        {/* 4 SETTLE */}
        <div className="flex w-[380px] flex-none snap-center flex-col gap-4">
          <StepHead n={4} label={STEPS[3]} />
          <Frame>
            <div className="flex items-center gap-2 border-b border-hairline-soft px-[14px] py-[11px]">
              <span className="h-[7px] w-[7px] animate-live-pulse rounded-full bg-verdigris" />
              <span className="font-mono text-[11px] text-mono-dim">wallet · autonomous</span>
            </div>
            <div className="flex flex-1 flex-col p-[18px]">
              <div className="mb-2 font-mono text-[11px] text-mono-dim">NANOPAYMENT</div>
              <div className="font-serif text-[40px] text-marble">
                {receipt ? receipt.amount_usdc : terms.amount}{" "}
                <span className="text-[20px] text-ash">USDC</span>
              </div>
              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-hairline-soft">
                <div className="h-full w-full bg-gradient-to-r from-verdigris to-[#74B7A4]" />
              </div>
              <div className="mt-2.5 flex justify-between font-mono text-[11px]">
                <span className="text-verdigris">SETTLED</span>
                <span className="text-ash">~412ms</span>
              </div>
              <div className="mt-auto flex flex-col gap-px overflow-hidden rounded-md border border-hairline bg-hairline-soft">
                <div className="flex justify-between bg-obsidian px-[13px] py-[11px] font-mono text-[11px]">
                  <span className="text-mono-dim">TX</span>
                  <span className="text-marble">{txShort}</span>
                </div>
                <div className="flex justify-between bg-obsidian px-[13px] py-[11px] font-mono text-[11px]">
                  <span className="text-mono-dim">STATUS</span>
                  <span className="text-verdigris">✓ {receipt ? "confirmed" : "illustrative"}</span>
                </div>
              </div>
            </div>
          </Frame>
        </div>

        {/* 5 UNLOCKED */}
        <div className="flex w-[380px] flex-none snap-center flex-col gap-4">
          <StepHead n={5} label={STEPS[4]} />
          <Frame>
            <Bar dot="#5FA391">feed · macro · 200</Bar>
            <div className="flex flex-1 flex-col gap-2.5 p-4">
              {(items.length ? items : []).slice(0, 3).map((it) => (
                <div
                  key={it.id}
                  className="rounded border border-verdigris/25 bg-verdigris/[0.03] p-3.5"
                >
                  <div className="mb-2.5 text-[13px] leading-snug text-marble">{it.question}</div>
                  <div className="flex gap-3.5 font-mono text-[11px]">
                    <span className="text-mono-dim">
                      conf <span className="text-marble">{confidencePct(it.confidence_bps)}%</span>
                    </span>
                    <span className="text-mono-dim">
                      ½-kelly <span className="text-gold">{it.kelly_fraction}</span>
                    </span>
                    <span className="text-mono-dim">
                      stance <span className="text-verdigris">{stanceWord(it.rating)}</span>
                    </span>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="flex flex-1 items-center justify-center font-mono text-[11px] text-mono-dim">
                  next cycle pending…
                </div>
              )}
            </div>
          </Frame>
        </div>

        {/* 6 SYNTHESIS */}
        <div className="flex w-[380px] flex-none snap-center flex-col gap-4">
          <StepHead n={6} label={STEPS[5]} />
          <Frame>
            <Bar dot="#C8A45D">
              trace · {lead ? shortHash(lead.trace_hash, 4, 2) : "0x7a…e1"}
            </Bar>
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-4 font-serif text-[22px] leading-tight text-marble">
                {lead ? lead.question : "Will the Fed cut by September?"}
              </div>
              <div className="mb-4 flex flex-col gap-2.5">
                {TRIAD_ORDER.map((key) => {
                  const a = lead?.agent_breakdown?.[key]
                  const pct = a ? Math.max(4, Math.min(100, a.confidence_bps / 100)) : 60
                  const isCal = key === "calibrator"
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`w-[62px] font-mono text-[10px] ${isCal ? "text-gold" : "text-mono-dim"}`}>
                        {AGENT_LABEL[key]}
                      </span>
                      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-hairline-soft">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: isCal ? "#C8A45D" : "#5FA391" }}
                        />
                      </div>
                      <span className={`font-mono text-[10px] ${isCal ? "text-gold" : "text-ash"}`}>
                        {a ? (a.confidence_bps / 10000).toFixed(2) : "—"}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mb-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline-soft">
                <div className="bg-obsidian px-2 py-3 text-center">
                  <div className="font-serif text-[24px] text-marble">
                    {lead ? `${confidencePct(lead.confidence_bps)}%` : "—"}
                  </div>
                  <div className="font-mono text-[9px] text-mono-dim">CONFIDENCE</div>
                </div>
                <div className="bg-obsidian px-2 py-3 text-center">
                  <div className="font-serif text-[24px] text-gold">
                    {lead ? lead.kelly_fraction : "—"}
                  </div>
                  <div className="font-mono text-[9px] text-mono-dim">½-KELLY</div>
                </div>
              </div>
              {lead && irysUrl(lead.irys_hash) ? (
                <a
                  href={irysUrl(lead.irys_hash)!}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto flex items-center justify-center gap-2 rounded-md border border-verdigris/35 p-3 font-mono text-[11px] text-verdigris transition-colors hover:bg-verdigris/5"
                >
                  ✓ VERIFY ON IRYS · ARC
                </a>
              ) : (
                <div className="mt-auto flex items-center justify-center gap-2 rounded-md border border-hairline p-3 font-mono text-[11px] text-mono-dim">
                  awaiting anchor
                </div>
              )}
            </div>
          </Frame>
        </div>
      </div>

      {/* INTEGRATION CODE */}
      <div className="mt-6">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-serif text-[30px]">Wire it in</h2>
          <Link href="/" className="font-mono text-[11px] text-ash transition-colors hover:text-gold">
            ← back to the feed
          </Link>
        </div>
        <CodeTabs tabs={codeTabs(terms.pay_to)} />
      </div>
    </div>
  )
}

const placeholderMarkets = [
  "Will the Fed cut ≥50bps by September?",
  "Will BTC close above $120k in Q3?",
  "Will a US recession be called in 2026?",
]

function codeTabs(payTo: string) {
  return [
    {
      id: "curl",
      label: "curl",
      code: `# 1. hit the feed — no receipt, you get a 402
$ curl ${FEED_URL}
> HTTP/1.1 402 Payment Required
{ "payment_terms": { "amount": "0.005", "asset": "USDC",
  "network": "arc-testnet", "pay_to": "${shortHash(payTo, 8, 4)}" } }

# 2. pay 0.005 USDC to pay_to on Arc, then retry with the tx hash
$ curl -H "X-402-Payment-Receipt: 0x<txhash>" \\
       ${FEED_URL}
> HTTP/1.1 200 OK   { "items": [ … ] }`,
    },
    {
      id: "python",
      label: "python",
      code: `import os, requests
from web3 import Web3

FEED = "${FEED_URL}"
w3 = Web3(Web3.HTTPProvider(os.environ["ARC_RPC"]))
acct = w3.eth.account.from_key(os.environ["BOT_PRIVATE_KEY"])

resp = requests.get(FEED)
if resp.status_code == 402:
    t = resp.json()["payment_terms"]            # 0.005 USDC on Arc
    usdc = w3.eth.contract(address=ARC_USDC, abi=ERC20)
    tx = usdc.functions.transfer(t["pay_to"], 5000).transact({"from": acct.address})
    receipt = "0x" + w3.eth.wait_for_transaction_receipt(tx)["transactionHash"].hex()
    resp = requests.get(FEED, headers={"X-402-Payment-Receipt": receipt})

for item in resp.json()["items"]:
    s = item["_stoa"]
    print(s["rating"], s["confidence_bps"], s["kelly_fraction"])`,
    },
    {
      id: "ts",
      label: "typescript",
      code: `const FEED = "${FEED_URL}"

let res = await fetch(FEED)
if (res.status === 402) {
  const { payment_terms } = await res.json()      // 0.005 USDC on Arc
  const txHash = await payUsdcOnArc(payment_terms) // your wallet pays the toll
  res = await fetch(FEED, { headers: { "X-402-Payment-Receipt": txHash } })
}

const { items } = await res.json()
for (const it of items) {
  const s = it._stoa
  console.log(s.rating, s.confidence_bps, s.kelly_fraction, s.irys_hash)
}`,
    },
  ]
}
