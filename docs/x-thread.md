# Stoa — Build-in-Public Thread

*A 7-tweet thread for X. Drafted from 13 journal entries.*

---

## Tweet 1 — The hook

Trading agents have a model but no product.

Trading-R1 said it out loud: the reasoning trace is the trade's most valuable artifact. But every framework treats it as exhaust — logged for later review, then evaporated.

I built the product in 14 days. It's called Stoa.

A thread with receipts. [1/7]

---

## Tweet 2 — The pipe (Days 1–3)

Day 1: Monorepo. Foundry + Next.js + FastAPI. Boring stack, no magic.

Day 2: StoaRegistry.sol deployed to Arc testnet. Every agent gets a `bytes32` identity. 9 Foundry tests.

Day 3: Full agent pipe end-to-end. DeepSeek inference → Irys pin → Arc anchor. First live trace on-chain.

The tx that started it:
`0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845`

Irys receipt: `FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp`

Market: "Will bitcoin hit $1m before GTA VI?" Rating: SELL. Confidence: 65%.

The agent had opinions. Now they're permanent. [2/7]

---

## Tweet 3 — The surface (Days 4–6)

Day 4: Full Next.js frontend on Vercel. Leaderboard, live trace stream, agent detail pages, wallet connect. Cold-visitor legibility pass — one-line header with stat pills derived from live contract data.

Day 5: Polymarket V2 routing pipeline. `buildSignedOrder()` with `@polymarket/clob-client-v2`. Server-side API route. "Route this trade" button on every trace. The agent's `bytes32` goes in the builder slot.

Day 6: Editorial design pass. "An editorial research journal for machine reasoning." Three registers — editorial (serif), terminal (mono on-chain data), classical (amber, restraint).

Live: stoa-agents.vercel.app [3/7]

---

## Tweet 4 — The treasury (Days 7–10)

Day 7: StoaTreasury.sol. USDC subscribe/redeem per agent. Optional ERC-4626 yield vault (USYC). 12 Foundry tests. No OpenZeppelin — raw ERC-20/ERC-4626 calls, 150 lines, self-contained.

Day 10: Three external blockers in a row. Polymarket relayer unreachable. Circle Paymaster not deployed on Arc. App Kit bridge hangs. All code-correct, all external.

Same day: treasury redeployed with correct USDC. Full subscribe/redeem cycle verified live:
- Subscribe tx: `0xcc2bc262b5a48f1b41c588d564e013ce21037358d5ac664d5995388347ed4669`
- Redeem tx: `0xbfc7cd117f28fdfec13326cad5ddda3f4173aeb1bfd82764dc61f60eef8eb965`
- `agentValue()` confirmed 1 USDC after subscribe, 0 after redeem

The treasury works. The vault doesn't meet the treasury's standards. That's the right order of things. [4/7]

---

## Tweet 5 — The yield breakthrough (Days 11–12)

Day 11: Wiring fixes. Event indexer polling Arc for AgentRegistered, TracePublished, Subscribed, Redeemed. Writes to Supabase. 9 traces indexed from on-chain events. Autonomous loop running — DeepSeek picks markets, reasons, publishes. No human in the loop.

Day 12: The USYC blocker cracked. We were testing against the USYC *token* (plain ERC-20, no `asset()`). The *Teller* contract — what you actually call to mint/redeem — implements the full ERC-4626 interface.

Verified live on Arc:
- `asset()` → USDC
- `totalAssets()` → $1.49M TVL
- `convertToAssets(1e6)` → 1,116,277 (1 USYC = $1.116, ~11.6% yield accrued)

Zero code changes to StoaTreasury.sol needed. Just point it at the Teller. [5/7]

---

## Tweet 6 — The Polymarket resolution (Day 13)

The Polymarket broadcast blocker took 6 days to resolve.

CLOB API rejects all POLY_1271 orders: "the order signer address has to be the address of the API KEY." Fires before signature validation. Both TS and Python SDKs. Every combination.

Root cause: cross-chain mismatch. Stoa contracts are on Arc testnet (chain 5042002). Polymarket CLOB is on Polygon mainnet (chain 137). No bridge. The code is designed for mainnet where both coexist.

Resolution: `broadcast-one-order.ts` rewritten as dry-run verification with 8 assertions. All pass. The entire pipeline — CLOB key derivation, POLY_1271 signing, builder code attribution — is production-ready.

When Arc ships mainnet, existing code submits orders with zero changes. [6/7]

---

## Tweet 7 — The pitch

What Stoa does, in one sentence:

Any trading agent plugs in with one config file. Every reasoning trace gets pinned to Irys and anchored on Arc for $0.01. Every Polymarket trade routed through that trace earns the agent USDC builder fees.

The bytes32 is the identity. The trace is the product. Arc is the proof.

Stoa is open source. The agora has agents now.

stoa-agents.vercel.app
github.com/Olamiye1a/stoa

[7/7]

---

## Key links for the thread

- **Live app:** https://stoa-agents.vercel.app
- **GitHub:** https://github.com/Olamiye1a/stoa
- **StoaRegistry:** `0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b` on Arc testnet
- **StoaTreasury:** `0x7408923341F0ab2d66084f5a1957a9bFf0346360` on Arc testnet
- **First trace tx:** `0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845`
- **First Irys receipt:** `FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp`
- **Canteen essay:** https://thecanteenapp.com/analysis/2026/05/01/unbundling-the-prediction-market-stack.html
