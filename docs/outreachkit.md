# Stoa Outreach Kit — The Lepton Distribution Playbook

**Rule #1: Do not sell a hackathon project.** Sell a high-fidelity, machine-readable data feed.
**Rule #2: Show, don't tell.** Always lead with the Python consumer script or a snippet of the JSON payload.

You are no longer selling to "crypto bros." You are selling to quantitative developers and open-source data hoarders.

---

## Quickstart — consume the feed in 5 minutes

Lead every conversation with this. It's the whole pitch: a developer goes from zero to ingesting cross-calibrated alpha in four commands.

**1. Taste it free — no wallet, no key.** The latest syntheses, ungated:

```bash
curl https://stoa-agents.vercel.app/api/v1/feeds/preview
```

Returns the 3 most recent items — market, rating, confidence, Kelly fraction, and the Irys hash for each. The full feed is gated; this sample is free so the schema can be inspected before wiring payment.

**2. Hit the gate.** The full feed answers with HTTP 402 + payment terms:

```bash
curl -i https://stoa-agents.vercel.app/api/v1/feeds/macro-alpha
# HTTP/1.1 402 Payment Required
# { "payment_terms": { "amount": "0.005", "asset": "USDC",
#   "network": "arc-testnet", "pay_to": "0xdf642780…3bb7" } }
```

**3. Pay the toll, unlock the feed.** The whole client is ~20 lines — `examples/byo-bot/consume_feed.py`:

```bash
pip install requests web3
export ARC_RPC="https://rpc.testnet.arc-node…"   # Arc testnet RPC
export BOT_PRIVATE_KEY="0x…"                       # funded with a little Arc USDC
python consume_feed.py
```

Expected output:

```
402 → paying 0.005 USDC to 0xdf642780…3bb7 on Arc…
paid: 0x4778…922c
Unlocked 10 alpha items:
  SELL -2 · 65% · Will Bitcoin hit $150k by December 31, 2026?
    rating=-2 conf=65% kelly=0  irys=29kYhM4kMW…
  …
```

The bot hits the 402, autonomously pays the sub-cent toll on Arc, retries with the receipt header, and ingests the Kelly fractions. Receipts are single-use and verified on-chain.

**4. Verify anything.** Every item carries an Irys hash and an Arc tx. Open `https://gateway.irys.xyz/<hash>` to read the exact reasoning, walk the loop at [`/flow`](https://stoa-agents.vercel.app/flow), or browse every published synthesis at [`/traces`](https://stoa-agents.vercel.app/traces).

> Need testnet USDC to try the paid path? Ping us — we'll fund your wallet to cover the first 1,000 pulls.

---

## Channel 1: Algo-Trading Subreddits (`r/algotrading`, `r/CryptoCurrency`, `r/quant`)

Quant devs hate marketing. They love clean data.

**The Play:** Post a technical deep-dive on how you built a metacognitive agent architecture to analyze Polymarket, and offer the raw JSON feed for their own backtesting.

> **Title:** I built an x402-gated RSS feed that streams cross-calibrated macro predictions for algo-trading (JSON/API)
>
> I was tired of scraping Twitter sentiment for macro trades. I built a Triad agent architecture — a structural/fundamental engine (Quantec), a Bayesian time-series engine, and a metacognitive Calibrator that penalizes the first two for their past errors — to analyze top-tier Polymarket macro events.
>
> It outputs a clean JSON feed with optimal Kelly Criterion fractions and immutable Irys hashes for the reasoning. Because I'm running heavy inference, the feed is gated behind a sub-cent API toll ($0.005/request) using HTTP 402.
>
> Wire your bot to ingest it autonomously with this 20-line Python script: [GitHub Gist]. Endpoint is live: `stoa-agents.vercel.app/api/v1/feeds/macro-alpha`. Let me know if the schema breaks your parsers.

## Channel 2: RSSHub Community (GitHub Issues / Discord)

RSSHub users are data aggregators. They want everything in one place.

**The Play:** Open a "Show and Tell" or feature request offering the Stoa endpoint as a premium upstream route.

> Hey all — I've built a middleware layer that streams structured, machine-analyzed prediction-market data (bull/bear cases + Kelly allocations), formatted to match RSSHub's JSON Feed schema. It uses an HTTP 402 gate for micro-billing ($0.005/request) so there's no monthly API key to test it. Would love to know if anyone wants to plug this into their terminal dashboards — or whether there's interest in a native RSSHub module for 402-gated feeds.

## Channel 3: Cold DMs to Trading Bot Maintainers (Freqtrade, Hummingbot plugin devs)

**The Play:** Offer them a better signal for their bots.

> Hey [Name], been following your commits on [Repo]. I built a machine-readable JSON feed that streams cross-calibrated macro reasoning (Fed rates, CPI, ETH perps) from a persistent-memory agent cluster.
>
> No subscription keys — it's gated by HTTP 402 nanopayments on Arc ($0.005/pull). Here's a gist of how your bot hits it, pays the sub-cent toll autonomously, and ingests the Kelly fractions: [Gist]. Want to test it? I'll fund your testnet wallet to cover the first 1,000 pulls.

## The Demo (3-minute hackathon video script)

- **0:00–0:30 — The Problem.** Quants need clean, structured reasoning, but LLM API keys are expensive and subscriptions suck. We built Stoa as an RSSHub sidecar.
- **0:30–1:30 — The Core.** Show the Triad architecture diagram. Show the Supabase memory logs proving the Calibrator penalizes bad past calls.
- **1:30–2:30 — The Magic.** Split screen. Left: the server. Right: a Python script in the terminal. Run it — watch it hit the 402, pay the nanopayment, and instantly print the unlocked JSON feed with the Kelly fraction.
- **2:30–3:00 — The Traction.** Show live server logs of programmatic users hitting the endpoint and paying the toll. "This is Stoa. The trace is the product, and now machines are paying for it."
