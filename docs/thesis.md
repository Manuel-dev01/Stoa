# The Trace as a Tradable Object

*Notes on a reasoning-trace bourse. Written at the end of fourteen days of building.*

In May 2026, three primitives that had nothing to do with each other landed close enough together to suggest they did. On April 25, Tauric Research shipped TradingAgents v0.2.4 with structured JSON outputs at three reasoning layers. Three days later, Polymarket migrated to CLOB V2, adding a `builder` field of type `bytes32` to the order struct and a per-fill fee mechanism allowing up to 100 bps taker and 50 bps maker attribution. The week after, Circle's Arc testnet crossed 244 million transactions in its public testing window, with USDC-denominated gas holding stable at the one-cent target. Each of these is independently interesting. Together they make a thing that did not exist before: an economical home for the reasoning trace.

Canteen's May 1 essay, *Unbundling the Prediction Market Stack* ([thecanteenapp.com](https://thecanteenapp.com/analysis/2026/05/01/unbundling-the-prediction-market-stack.html)), named the convergence. They observed that the same `bytes32` attribution slot was appearing in three independent venues, namely Polymarket V2, Hyperliquid HIP-3, and Pump.fun's `BREAKING_FEE_RECIPIENT` upgrade, and that the pattern was a generalized agent-identity primitive looking for a substrate. The essay closed with a question rather than a product: what does the trace become when it has an on-chain identity? Stoa is one possible answer.

## The trace as it stood

For most of agentic trading's short history, the reasoning trace has been a private artifact. TradingAgents v0.2.4 emits beautifully structured JSON (Bull Researcher, Bear Researcher, Research Manager synthesis, Trader rationale, Portfolio Manager risk gate), but the framework's authors describe this output as something the user "logs for later review." Trading-R1 (Wang et al., September 2025) goes further: the paper argues that the trace is the primary product and the trade rating is a downstream classification head, but the artifact's distribution remains a research preview. Numerai obfuscates features by design. Bittensor's Synth and SN8 expose aggregated outputs, not individual reasoning. The trace has been treated as exhaust.

This is not because the trace lacks value. It is because publication has been uneconomical. Posting a 5-kilobyte reasoning artifact to Ethereum L1 has cost between $1.80 and $40 in gas depending on conditions over the past two years. At one trace per decision per market and an agent active on twenty markets, daily publication runs $36 to $800. The PnL of the underlying trades cannot support this. So the trace stayed off-chain, and its authors stayed unmonetized.

## The convergence, technically

Polymarket V2's `matchOrders` function on `CTFExchangeV2` now reads the `builder` field as a 32-byte identifier paired with a basis-point fee schedule per order. The exchange computes the fee at fill time and routes it directly to the registered builder's address in pUSD (Polymarket's USD stablecoin on Polygon). The mechanism is non-custodial. Polymarket never holds builder funds. The settlement is atomic, completed in the same Polygon block as the underlying trade. As of mid-May 2026, the top six Polymarket builders collectively control 81% of all third-party volume through this layer, with Betmoar (a Telegram bot) clearing over $12M weekly. The fee economics work. The attribution is on-chain. The matching is venue-native.

Circle's Arc complements this with the right physics for publication. Sub-second deterministic finality (~780ms in our testnet measurements) means a trace published at the moment of decision is anchored before the user can act. Gas denominated in USDC at approximately $0.01 per transaction means an agent emitting one trace per decision across twenty markets daily costs $0.20 to operate the publication layer. The arithmetic that broke on Ethereum closes on Arc.

The remaining piece is permanence. Trace content is too large for direct on-chain storage even at Arc's prices, but the integrity guarantee requires that the on-chain hash and the canonical body be inseparable. Irys provides millisecond-precision content-addressed storage with permanent retention for roughly $0.0001 per upload. The pattern is well-understood: hash the trace, post the hash and the Irys receipt on Arc, store the body on Irys. Anyone with the receipt can verify the body. Anyone with the body can re-derive the hash. The chain is the index; Irys is the archive.

## Aristotle, used substantively

In *Nicomachean Ethics* Book V, Aristotle works through what makes exchange possible. His argument is that *all things that are exchanged must be somehow comparable*. Two things become comparable when they share a unit of account, money in the human case, but more fundamentally any common measure that makes exchange calculable.

A reasoning trace and a trade have not been comparable until now. The trace is a string of text; the trade is a fill on a CLOB. They live in different systems with different identities. The `bytes32` agent identifier does not make them comparable in Aristotle's sense; that job belongs to the shared currency (USDC, pUSD). What the `bytes32` does is make them *linkable*. The same identity appears in the `TracePublished` event on Arc and in the `builder` field of a Polymarket V2 order, enabling attribution: the trace caused the trade, and the trade can pay the trace. The `bytes32` is the address; the currency is the measure. Both are necessary.

This is what the agora was. Aristotle in *Politics* VII calls the agora the heart of the city, but the substance of the claim is that the agora is where things become comparable to each other because they are all addressable from the same square. Stoa, the porch, was a place inside this square. Zeno taught there because the foot traffic between transactions made reasoning audible to the people doing the transacting. The architecture of physical proximity made the comparison work.

The `bytes32` slot does the same job in software.

## What Stoa builds on this

Stoa is a registry contract on Arc that assigns each agent a `bytes32` identity owned by exactly one address. The agent uses this identity to sign and publish traces, which land as `TracePublished` events with the trace hash, the Irys receipt, a market identifier, a rating, and a confidence score. Users browsing the Stoa web app see live traces alongside the markets they describe. When they decide to act on an agent's reasoning, they route their Polymarket order through Stoa's frontend, which inserts the agent's `bytes32` into the V2 builder slot. Polymarket fills the order; the builder fee accrues to the agent's wallet in pUSD. The agent's idle treasury parks in USYC between trades.

The protocol is non-custodial at every layer. Users hold their own funds; agent operators hold their own keys. Stoa contributes one field on the order. The leaderboard ranks agents by realized profit attributable to their published reasoning. Anyone can plug in.

In fourteen days of building, Stoa shipped:

- **25+ agents registered**, each with a unique `bytes32` identity on Arc. Six analytical archetypes (stoikos, heraklit, phyrr, artemis, athena, hermes) are derived by the classifier from each trace's reasoning, not self-declared.
- **324+ traces published**, each hash-linked to its Irys body, each anchored on Arc with a sub-second `TracePublished` event.
- **Server-side persona classification**. After each trace publishes, a DeepSeek classifier reads the bull/bear/synthesis text against the six archetype rubrics and tags the trace with a `classified_persona`, confidence value, and one-sentence rationale. The agent's persona on the leaderboard is the mode of those classifications across its traces. Reasoning is the label. This is the strongest version of Aristotle's commensurability: not just the trade comparable to the trade, but the *style of thinking* itself made comparable.
- **Per-agent builder fee attribution end-to-end**. At registration, an agent supplies its Polymarket builder EOA (registered at polymarket.com/settings); Stoa stores the EOA off-chain against the agent's on-chain `bytes32`. At trade time, the V2 signing pipeline looks up the agent's builder EOA and writes it into the order's `builder` field. Fee routing is per-agent by construction. Not to a shared house code, not to the Stoa `bytes32` (which Polymarket doesn't recognize as a builder).
- **Two-venue ingestion**: Polymarket V2 and Kalshi markets both flow into the multi-agent daemon. Polymarket conditions are settled directly on chain; Kalshi tickers are hashed to `bytes32` before anchoring.
- **A complete agent SDK** with two integration paths: REST API for shell-based plugs, and a TypeScript SDK (`@stoa-agents/sdk`) for native imports. Both expose `registerAgent`, `publishTrace`, `hashTrace`, `getMarketTokenIds`, and `buildSignedOrder`.
- **A live frontend** at [stoa-agents.vercel.app](https://stoa-agents.vercel.app) with leaderboard, trace stream, agent detail pages, treasury subscribe/redeem flow, Polymarket route-this-trade button, and Dynamic-backed email/social wallet onboarding for non-crypto users.

Real receipts behind each number live in the [project README](../README.md) and the [Day-14 audit](audit.md).

## What I'm still unsure of

Whether agent operators actually want public traces. Trace publication is a credible commitment, but it is also a competitive disclosure. Slashing-bonded copy-trading mechanisms may be a necessary complement; without skin in the game, public reasoning is cheap talk. We will know in three months whether the leaderboard's profit-weighted ranking is enough.

Whether Polymarket's market curation gates the supply of opportunities. Polymarket today curates markets centrally; the long tail of niche events where an agent has real edge may not exist on the venue. Stoa's value compounds as the venue's market count grows. We are betting that the V2 builder economics will pull more market types onto the platform, but this is a venue-side prediction, not a Stoa-side one.

Whether Arc's sub-second finality holds at mainnet load. Our testnet measurements average 780ms. The economics of one-trace-per-decision break above ~3 seconds. We do not yet know what mainnet looks like under real congestion.

Whether per-agent builder code registration becomes a practical bottleneck. Polymarket today requires builder codes to be registered through their settings UI before fees route on a per-code basis. Stoa decouples the on-chain Stoa identity (a deterministic `bytes32` from `keccak(msg.sender, nonce)`) from the Polymarket-recognized builder EOA, which is supplied at registration and stored off-chain. That split means an agent operator can register their Polymarket builder code once through Polymarket's UI and re-use it across many Stoa identities they own, or rotate it without redeploying anything. The pure-on-chain alternative would have welded the two together and made mass-onboarding hostile. The mainnet question, whether Polymarket eventually ships a programmatic builder registration API, is still open. We chose the structural answer that doesn't depend on it.

These are the kinds of questions you can only answer by shipping. We shipped.

## What I'd bet on

Three predictions, each falsifiable within twelve months.

First, every serious trading agent framework will ship with a native `bytes32` identity primitive by Q3 2026. The pattern is not Stoa-specific; it is venue-specific. TradingAgents, Trading-R1, AlpacaTradingAgent, MiroFish, OASIS, and the rest will all eventually expose `agentId` as a first-class export from the SDK because their users will ask for it.

Second, the reasoning trace will become a queryable asset class within twelve months. Markets will exist on "which agent's reasoning will outperform over the next 30 days," with the underlying signal being the on-chain attribution layer we are describing here. Numerai's tournament structure is the closest analog, but it required centralization; the `bytes32` slot lets the same shape work without a trusted operator.

Third, and this is the one I'm least sure of but most interested in: within twelve months, the trace itself will become the primary content artifact of agentic finance, and trade execution will become commoditized infrastructure underneath it. The thing humans value, and pay for, is good reasoning. The trade is the proof. We have spent a decade building markets for the proofs while leaving the reasoning to evaporate. Stoa is one bet on inverting that.

---

*Stoa is substrate, not arbiter. Any agent can publish any reasoning; the leaderboard is where quality gets priced. The protocol's job is to keep the publication cheap, the attribution verifiable, and the fee accrual atomic, not to judge the thought.*

*Stoa is open source under MIT. The contracts are deployed and verified on Arc testnet. The bytes32 is the identity. The trace is the product. The agora has agents now.*

*Emmanuel, May 25, 2026.*
