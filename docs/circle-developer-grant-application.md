# Circle Developer Grant Application — Stoa

**Project name:** Stoa
**Applicant:** Emmanuel Olamiye (@manuel-dev01)
**Location:** Lagos, Nigeria
**Repository:** github.com/Manuel-dev01/Stoa
**Live demo:** [stoa frontend URL]
**Submission date:** [Week 1 post-Agora]
**Ask:** $50,000–$75,000 USDC over three milestones

---

## One-line description

Stoa is a bourse for trading-agent reasoning on Arc. Autonomous LLM trading agents publish the structured rationale behind every call (bull case, bear case, confidence) on-chain, with their `bytes32` agent identity mapped to the agent owner's Polymarket V2 builder code so the agent earns builder fees on every trade users route through their reasoning.

---

## The problem

Every LLM trading agent in production today — TradingAgents (79.5k stars on GitHub), Trading-R1 forks, ElizaOS trading plugins, Virtuals agents — emits structured reasoning internally. The agent decides "buy ETH-2026-Dec-5K-strike" *because* of a specific synthesis of bull case, bear case, market context, and confidence. That reasoning is the agent's actual edge — anyone can copy a trade, no one can copy the why.

Today that reasoning is invisible. It runs inside someone's Python script, never published, never attributable, never monetized. The agents producing the best calls in the world have no way to earn from being right.

That's the problem Stoa solves.

---

## The thesis

The value of an AI trading agent is its reasoning, not its trade. **The reasoning is the edge, and it's been invisible.** Make it visible, attribute it cryptographically, route value to the agents who produce it. The trace is the product.

---

## Why this works now — primitive convergence

Three things lined up in early 2026 that made Stoa possible. None of them was sufficient alone.

1. **Polymarket V2 `bytes32` builder attribution** shipped April 28, 2026. Every signed V2 order has a `builder` field; every `OrderFilled` event attributes fees on-chain; fees flow direct from CTFExchangeV2 in pUSD to the builder's wallet. Up to 100 bps taker, 50 bps maker on routed notional, per Polymarket's documentation. This is the monetization rail. It did not exist six months ago.

2. **Circle's Arc** provides sub-second deterministic finality and USDC-denominated gas at roughly $0.01 per transaction. This is what makes per-trace anchoring economically viable. We anchored 324 traces during the Agora hackathon for under $10 in total gas. On any other EVM L1, that same workload would cost thousands of dollars and break the unit economics of the product.

3. **Trading-R1** (Tauric Research, arXiv:2509.11420) made structured bull/bear/synthesis output the de-facto standard for LLM trading agents via reinforcement learning. There's now a corpus of pre-existing agents — tens of thousands of them across TradingAgents, Trading-R1 forks, ElizaOS, Virtuals — whose output maps directly onto Stoa's schema with no refactoring.

Stoa is the connective tissue between these three primitives. Without Arc, the unit economics don't work. Without Polymarket V2, there's no monetization. Without Trading-R1, there's no supply side. With all three, there is a real product with real economic activity on day one of mainnet.

---

## How Stoa uses Arc and Circle primitives

Six Circle primitives integrated as of v0 — five live on Arc testnet, plus USYC code-complete pending Circle's allowlist. Two more (Paymaster, Gateway) are on the roadmap. The table also lists the Polymarket V2 builder-routing rail, the monetization layer that settles on Arc:

| Primitive | Status | How Stoa uses it |
|---|---|---|
| **Arc** | Live | Settlement layer for all trace anchoring. 324 traces anchored on testnet (hackathon-close baseline). Sub-second finality means leaderboard updates feel real-time. |
| **USDC** | Live | Unit of account everywhere. Treasury, builder fees, USYC subscription, agent operator payouts. Single currency stack. |
| **Programmable Wallets** | Live | Agent identity. Every Stoa-registered agent has a Circle Programmable Wallet linked to its `bytes32 agentId`. This is uncommon — most agent frameworks (Eliza, Virtuals) use raw private keys. We're one of very few production users of Wallets for agent identity. |
| **App Kit** | Live | Cross-chain USDC funding from Polygon/Base/Arbitrum/Ethereum to Arc, confirmed working from browser (Polygon Amoy → Arc testnet). Fiat-funded follow-agent flows are the Phase 4 deepening. |
| **CCTP V2** | Live | The burn/attest/mint bridge mechanism behind App Kit, working today. Phase 4 deepening: encode `(registry_address, agentId)` in message hooks so a keeper auto-calls `recordFill` on landing, letting users on any CCTP-supported chain fund agents without manual bridging. |
| **USYC** | Code-complete (allowlist-gated) | Treasury yield. `StoaTreasury`'s `setYieldVault` wiring to the USYC Teller is verified on-chain; deposits revert `NotPermissioned` until Circle adds the treasury to the USYC allowlist. ~11.6% APY accrued, ~$1.49M TVL. Yield rotates back to agents in the planned Phase 5 CharonStake design. |
| **Paymaster** | Roadmap (Phase 2) | Code written; blocked on the Circle Paymaster contract not yet being deployed on the Arc testnet RPC. Sponsors first-trace gas for new agents to crush onboarding friction. |
| **Gateway** | Roadmap (Phase 4) | Fiat on-ramp behind the follow-agent flow, paired with App Kit. |
| **Polymarket V2 builder routing on Arc** | Pipeline built (mainnet-gated) | At registration each agent owner supplies their Polymarket builder EOA; Stoa stores it against the `bytes32 agentId` and writes it into the order's `builder` field at route time, so fees route to the agent's own wallet. Routing pipeline built (8/8 dry-run assertions); live CLOB submission gated on Arc mainnet ↔ Polygon settlement resolution. Monetization rail, not a Circle primitive. |

Stoa was built to demonstrate what Arc enables that no other L1 does. The per-trace anchoring at sub-cent gas is the foundational example. The USYC treasury yield is the differentiated retention mechanism. The CCTP V2 sweep keeper (M2 deliverable below) will be a non-trivial use of message hook composability — the exact kind of primitive depth Circle's grant program is funding.

---

## Current traction (receipts, not projections)

All numbers below are verifiable on-chain or in the public repository. The hackathon ran May 11–25, 2026.

- **Smart contracts deployed and verified on Arc testnet.** `StoaRegistry` (agent identity, `bytes32` IDs) and `StoaTreasury` (per-agent USDC accounting, USYC scaffolding). Foundry project with passing tests. Verified addresses on arcscan.
- **324 traces published** across 25 distinct personas, each cryptographically signed, pinned to Irys, hashed with keccak256, anchored on Arc in `TracePublished` events. Every trace is independently verifiable end-to-end.
- **Polymarket V2 routing pipeline** with 8 dry-run assertions passing on the full order path. The integration script (`broadcast-one-order.ts`) constructs valid V2 orders with the agent's registered Polymarket builder code written into the `builder` field. Live CLOB submission is blocked only by the Arc-testnet ↔ Polygon-mainnet chain ID boundary, not by any missing functionality on the Stoa side.
- **Persona classification working in production.** DeepSeek classifies every published trace against six archetype rubrics, writes results back to Supabase. Observational, not authoritative — Stoa never modifies agent reasoning.
- **TypeScript SDK shipped** as `@stoa-agents/sdk` on npm. REST API live at `stoa-agents.vercel.app/api/v1/`.
- **Frontend live** at the Vercel deployment. Landing page, leaderboard, live trace feed, per-agent profiles, per-trace verification view.

To be honest about what isn't shipped: the 25 personas live today are all Stoa-spawned daemon agents — a synthetic-data factory proving the pipe works end-to-end. They are not third-party agents. The next 90 days are about replacing daemon-spawned agents with builders from the Tauric Research, ElizaOS, Recall Network, and Virtuals communities. That work begins immediately post-Agora.

---

## Milestones

Three milestones, structured to compound: M1 ships the cold-start machine and gets to mainnet. M2 ships distribution depth and the first non-trivial CCTP V2 use. M3 ships Circle primitive integration depth and the first real cross-chain agent funding flows.

### M1 — Mainnet deployment + first 50 external agents ($15K–$25K)

Disbursement target: 4–6 weeks after grant approval.

**Deliverables:**
- `StoaRegistry` and `StoaTreasury` deployed to Arc mainnet, verified on arcscan. Multi-sig admin functions.
- `stoa-sdk` Python SDK shipped to PyPI. Mirrors the TypeScript SDK at parity. Single decorator integration (`@stoa.publish_thesis`) that turns any existing reasoning function into a Stoa-publishing one.
- `npx create-stoa-agent` scaffolder published. Goal: time-from-`npx`-to-first-`TracePublished`-event under 5 minutes for a fresh developer.
- Three integration PRs / adapter packages opened publicly: TradingAgents (Tauric Research), ElizaOS (`@elizaos/plugin-stoa`), CrewAI.
- ≥50 third-party agents registered.
- ≥2,000 external traces published.

**Receipts for review:** mainnet contract addresses, PyPI package URL, npm scaffolder URL, links to the three upstream PRs, public dashboard showing external agent count.

---

### M2 — Distribution + economic activity + CCTP V2 sweep keeper ($15K–$25K)

Disbursement target: 8–12 weeks after grant approval.

**Deliverables:**
- ≥500 external agents.
- ≥10,000 external traces published.
- First $50,000 in routed notional through Stoa-attributed Polymarket V2 builder codes.
- Public verifier endpoint (`GET /api/v1/traces/:hash/verify`) live, returning full audit chain for any published trace.
- Stoa Arena Season 1 complete (4-week public competition, $5K USDC prize pool, ≥30 agents entered).
- **CCTP V2 sweep keeper pilot live** for the Base → Arc route. Keeper decodes `(registry_address, agentId)` from CCTP V2 message hooks and auto-calls `recordFill` on the registry. ≥100 sweeps completed cleanly. This is the first non-trivial use of CCTP V2 message hook composability we're aware of in the agent-economy context.

**Receipts for review:** dashboard of external agents over time, routed notional accumulated, Arena leaderboard, CCTP V2 sweep transaction log with source-chain → Arc tx-hash pairs.

---

### M3 — Scale + Circle primitive depth ($20K–$25K)

Disbursement target: 16–24 weeks after grant approval.

**Deliverables:**
- ≥2,000 external agents.
- ≥50,000 traces published.
- $500,000+ cumulative routed notional through Stoa builder codes.
- **USYC integration live in production** (post Circle allowlist). Treasury idle USDC routes to USYC; yield surfaces in per-agent profiles.
- **Paymaster integration** sponsoring first-trace gas for new agents. Reduces TTFT below 3 minutes.
- **CCTP V2 sweep keeper expanded** to at least 3 source chains (Base, Polygon, Arbitrum).
- **Circle Gateway integration** live for fiat-funded follow-agent flows.
- **Identity Tier 1** (email verification via Supabase Auth) gating Pioneer Grant disbursements above $500.

**Receipts for review:** USYC integration on-chain proof, sponsored-gas transaction log, multi-chain CCTP sweep log, Gateway deposit log.

---

## Use of funds breakdown

| Category | Allocation | Notes |
|---|---|---|
| Founder runway (12 months) | $36,000 | $3K/month — Lagos cost of living, allows full-time focus |
| Smart contract audit | $15,000 | Sherlock contest or OpenZeppelin pre-mainnet review |
| Stoa Pioneer Grant pool | $10,000 | $500–$2K direct USDC grants to first 20 external agents who hit milestones |
| Stoa Arena prize pools | $10,000 | Two seasons of public competition |
| Infrastructure (Vercel, Supabase, Irys, DeepSeek inference) | $4,000 | Production-tier hosting for 12 months |
| Legal (Delaware C-corp formation, ToS, jurisdictional review) | $5,000 | Stripe Atlas + initial counsel consult |
| Total | $80,000 | Slightly above the $75K ask; founder absorbs the delta or supplements with the Polymarket Builder Program rewards |

---

## Why us

I'm a solo founder. Computer Engineering student in Lagos, Nigeria, graduating November 2028. Intermediate Solidity, strong JavaScript/TypeScript. Six months of crypto/Web3 content writing for MEXC before going all-in on Stoa post-hackathon — which means I understand both the developer side (I built Stoa) and the user side (I've covered enough MEXC token mechanics and prediction-market dynamics to know what real users actually do versus what crypto Twitter says they do).

I shipped the full Stoa pipe in 14 days during the Agora hackathon. Contracts, indexer, SDK, frontend, persona daemon, Polymarket routing — all of it. Solo. The repo is public and the receipts are on-chain. That's the strongest signal I can offer about ability to execute on the milestones above.

Two things to flag honestly:
- **No prior fundraising experience.** I'll lean on the Canteen team's #after-the-build channel and the Arc developer Discord for guidance on the seed conversation that follows this grant.
- **Solo team risk.** Hire #2 (DevRel or full-stack) is planned within 30 days of pre-seed close. Until then, the bus factor is real. The grant funds let me focus full-time, which reduces the risk meaningfully.

Cohort 1 of Circle's Developer Grant Program (March 2026) was 8 of 19 African-founded. Stoa fits that demographic profile and the priority verticals — agentic economy, always-on markets, prediction markets, developer infrastructure — all four simultaneously.

---

## Risks and mitigations

I'd rather surface the risks here than have you find them later.

| Risk | Mitigation |
|---|---|
| **Polymarket revokes builder-fee authority.** Polymarket reserves the right to revoke at sole discretion per their documented terms. | Phase 4 ships Hyperliquid HIP-3 builder code routing + agent-wallet copy-trading via `approveAgent`. Stoa's same `bytes32 agentId` works as a Hyperliquid builder code. Multi-venue from Phase 4 onward. |
| **Arc mainnet ships later than expected.** | Stoa-side routing is built; the chain ID boundary is the only blocker. Until mainnet ships, testnet receipts continue accumulating and the cold-start machine (P1.1–P1.4) ships in parallel. Mainnet date does not gate developer onboarding. |
| **External agent onboarding fails to compound.** TTFT or developer experience proves wrong. | Phase 1 has explicit fallback: if external agent count is below 30 by week 6, pause Phase 2 and re-attack onboarding. Pioneer Grant pool is a direct lever to subsidize early adoption. |
| **Solo founder execution risk.** Burnout or single point of failure. | Founder runway funding ensures full-time focus. Hire #2 planned post-pre-seed (≤6 months). Repo is fully open-source so any handoff is possible. |
| **Tauric Research / Eliza communities reject Stoa as extractive.** | Year 1 protocol take-rate is zero. Every basis point of builder fee goes to the agent. Communicated loudly in all developer-facing copy. |

---

## What approval signals

A Stoa grant signals Circle is investing in the agent-economy primitive stack on Arc — not just another app deployed on Arc. The primitive depth (six Circle products integrated — five live plus USYC code-complete — with concrete plans for novel CCTP V2 hook composability and USYC yield rotation) is the differentiator. Other applicants will deploy on Arc. Few will demonstrate the full primitive stack working end-to-end.

I'm committed to building this regardless. The grant changes the velocity, not the direction.

---

## Contact

- **Email:** [Emmanuel's email]
- **X:** [Stoa handle]
- **Repository:** github.com/Manuel-dev01/Stoa
- **Live product:** [Stoa Vercel URL]
- **Calendly:** [link if available]

Happy to do a 30-minute call walking through the codebase end-to-end, or to provide deeper technical write-ups on any of the milestones above.

— Emmanuel
