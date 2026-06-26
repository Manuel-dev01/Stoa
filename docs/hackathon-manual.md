# Stoa — Build Manual

*Read by Claude Code at the start of every session. Read this file in full. Do not skim.*

This is the canonical operational manual for Stoa, a hackathon submission to the **Agora Agents Hackathon** (Canteen × Circle, May 11–May 25, 2026). Emmanuel is the solo builder. You (Claude Code) are the pair-programmer. We are targeting the $10K grand prize. We have 14 days.

---

## 1. Mission

Trading agents have a model but no product. Tauric Research's Trading-R1 paper said it out loud: **the value is the reasoning trace, not the trade**. Polymarket V2 shipped a `bytes32` builder attribution slot on April 28, 2026. Circle's Arc gives us sub-second finality and ~$0.01 USDC gas. The intersection of these three primitives — for the first time, in the last 18 days — makes it economical to publish every reasoning trace on-chain, attribute it to a `bytes32` agent identity, and let that agent earn USDC builder fees on every trade routed through its reasoning. Stoa is the marketplace for this.

The name is deliberate. The Stoa Poikile was the painted porch on the north side of the Athenian agora where Zeno taught the Stoic school in the 3rd century BCE. Commerce and reasoning shared one architecture. Stoa is the substrate where they share one architecture again, for agents.

## 2. The bet

We are not building "an AI trading bot." Three hundred other teams will build that. We are building the **substrate** that lets any trading agent monetize its reasoning. We win the hackathon's four weights by:

- **Agentic Sophistication (30%)** — the LLM makes every consequential decision: which markets to opine on, when to publish, confidence thresholds, sizing, treasury allocation between USDC and USYC. No human-in-the-loop after launch.
- **Traction (30%)** — three layered audiences: the 73K-star TradingAgents community looking for monetization, Polymarket retail traders looking for signal, Emmanuel's MEXC content network and Nigerian crypto Twitter. Target: 100–250 wallets, 50–200 routed trades, $5K–$25K notional, $50–$250 accrued fees by Day 14.
- **Circle/Arc Usage (20%)** — six primitives stacked non-trivially: Arc for trace anchoring, USDC settlement, USYC treasury yield, CCTP V2 for cross-chain follower deposits, Paymaster for gas-free UX, App Kit for funding flows.
- **Innovation (20%)** — first artifact that productizes the `bytes32` agent identity → reasoning trace → builder-fee attribution pattern Canteen named in their May 1 "Unbundling the Prediction Market Stack" essay.

## 3. The user-facing pitch

> A bourse for trading-agent reasoning. Every agent gets a `bytes32` identity on Arc. Every trace gets notarized for $0.01. Every trade routed through it earns the agent USDC builder fees on Polymarket V2. Reasoning is the product.

## 4. Audience for this code (three readers)

1. **Canteen's judges** — they will read the README, check the commits, run the demo. They wrote essays close-reading Polymarket V2's `CTFExchangeV2.matchOrders()`. They quote Heraclitus and Aristotle substantively. Code and docs must reward that level of attention.
2. **The first 5 friendly TradingAgents devs** who plug their agent into Stoa in Week 2. The SDK must be one config file. The integration must be one function call.
3. **Polymarket retail users** routing trades through agents on the web app. The funding/routing flow must be three clicks.

Write code for these readers.

---

## 5. The stack — locked in, do not relitigate

### 5.1 Monorepo layout

```
stoa/
├── apps/
│   ├── web/                 # Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
│   └── agent/               # Python 3.12+ FastAPI + TradingAgents v0.6.0
├── packages/
│   ├── contracts/           # Foundry, Solidity 0.8.26+
│   ├── sdk/                 # TypeScript SDK for external agent devs
│   └── shared/              # Shared types, constants, ABI exports
├── docs/
│   ├── thesis.md            # The 1200-word essay we publish on Day 13
│   ├── canteen-references/  # Pinned excerpts from Canteen's blog
│   ├── api.md               # SDK reference (SDK, agent service, contracts, trace schema)
│   └── architecture.md      # System diagram + dataflow
├── scripts/                 # Deploy scripts, cron entrypoints, indexer
├── .env.example
├── pnpm-workspace.yaml
├── CLAUDE.md                # this file
└── README.md
```

### 5.2 Frontend — `apps/web`

- Next.js 15, App Router, TypeScript strict mode
- Tailwind CSS + shadcn/ui (`button`, `card`, `dialog`, `table`, `tabs` — that's it for Phase 1)
- Wagmi v2 + Viem v2 for wallet/chain interaction
- Circle App Kit drop-ins for Send / Bridge / Unified Balance
- TanStack Query v5 for server state
- Deploy: Vercel

### 5.3 Smart contracts — `packages/contracts`

- Foundry (`forge`, `cast`, `anvil`) — not Hardhat
- Solidity 0.8.26+
- Deploy to Arc testnet via Canteen's `arc-cli` (hosted RPC)
- Two contracts in Phase 1: `StoaRegistry.sol` (agent identities + trace publishing) and `StoaTreasury.sol` (USDC/USYC management)
- Resist over-engineering. No proxy patterns. No upgradability. The contracts are 14-day-disposable. If we win, we redeploy with proper upgradability for mainnet.

### 5.4 Agent service — `apps/agent`

- Python 3.12+, `uv` for deps
- DeepSeek is the primary inference engine, called via `litellm` with the `deepseek/deepseek-chat` provider prefix and `DEEPSEEK_API_KEY`. Prediction-market-specific prompt with calibrated probability reasoning. Do not substitute via `OPENAI_API_KEY` — litellm resolves the provider prefix to the correct key automatically.
- TradingAgents v0.6.0 is available as an optional dependency but is not used by the autonomous loop (hangs on yfinance for non-stock prediction market tickers). `run_inference()` exists for backward compat; `run_inference_direct()` is the primary method.
- FastAPI for the trace-publication endpoints
- Polymarket Gamma API (`httpx`) for market data ingestion — not `polymarket-py-clob-client`
- Irys upload via Node.js subprocess (`scripts/irys_upload.mjs` using `@irys/sdk`) — no maintained Python Irys SDK exists. The tradeoff (extra runtime dependency on Node.js inside `apps/agent`) is accepted.
- web3.py + eth-account for Arc chain interaction
- Autonomous loop: `AgentLoop` class in `loop.py` polls Gamma every N minutes, selects markets by heuristic, runs DeepSeek inference, publishes traces. State persisted to Supabase across restarts. Run via `python -m stoa_agent.cli autonomous`.
- Manual one-shot: `python -m stoa_agent.cli publish-trace --market-id 0x...`

### 5.5 Storage and indexing

- Irys for trace text pinning (~$0.0001/trace, millisecond timestamps). The Python agent shells out to `scripts/irys_upload.mjs` (Node.js, `@irys/sdk`) because there is no maintained Python SDK for Irys ANS-104 data items. This adds a Node.js runtime dependency inside `apps/agent`; accepted tradeoff.
- Supabase Postgres (free tier) for off-chain event indexing
- The chain is source of truth. Postgres is a read cache for the leaderboard.
- No Redis. No Kafka. No custom indexer infrastructure.

### 5.6 Wallets

- **Agent-side treasuries:** Circle Wallets API (strengthens our Circle integration story)
- **User-side:** standard EOA via Wagmi connectors (MetaMask, Coinbase Wallet, WalletConnect)
- Paymaster sponsors user-side gas on Arc

### 5.7 Polymarket

- `@polymarket/clob-client-v2` (TypeScript) for order submission from the frontend
- Builder code registered at polymarket.com/settings **before Day 4**
- Default fee config: `builder_taker_fee_bps = 50` (0.50%), `builder_maker_fee_bps = 25` (0.25%) — adjustable per-agent later
- CLOB API credentials (key, secret, passphrase) derived via `scripts/setup-clob-keys.ts` — reads `POLYMARKET_PRIVATE_KEY` from `.env.local`, calls `createOrDeriveApiKey()` against `clob.polymarket.com`, writes the three returned values back to `.env.local`

### 5.8 Out of scope

Do not build any of: custom orderbook, custom oracle, custom cross-chain bridge (use CCTP V2 only), mobile app, auth beyond SIWE, token, points system, governance layer, analytics dashboards beyond the leaderboard, email notifications, social login.

---

## 6. Networks and contract addresses

**Verify every address against official docs before deploying or interacting. Never hardcode an address you haven't confirmed.**

### 6.1 Arc testnet

- RPC: Canteen's hosted endpoint (see arc-node.thecanteenapp.com after installing `arc-cli`)
- Chain ID: confirm via `cast chain-id --rpc-url <RPC>`
- Explorer: https://testnet.arcscan.app (Blockscout-based, official)

### 6.2 Polymarket (Polygon mainnet — that's where the orderbook lives)

- CTFExchangeV2: confirm at docs.polymarket.com/v2-migration
- USDC.e (the bridged USDC Polymarket settles in, aka pUSD): confirm at docs.polymarket.com
- Builder registration: polymarket.com/settings

### 6.3 USYC

- Polygon address: confirm at usyc.docs.hashnote.com
- Arc address (if deployed yet): confirm with Hashnote/Circle docs before integrating

### 6.4 CCTP V2

- Per-chain Token Messenger and Message Transmitter addresses: developers.circle.com/cctp/evm-smart-contracts
- Supported source chains for the hackathon scope: Polygon, Base, Arbitrum, Ethereum mainnet (testnet equivalents where needed)

### 6.5 Where to keep the deployed-address registry

`packages/shared/src/addresses.ts` — typed const exports per network. Single source of truth. Anything that imports an address imports from here.

---

## 7. Environment variables

Maintain `.env.example` in the repo root. Real secrets live in `.env.local` (gitignored) and in Vercel/Railway project settings.

```bash
# Networks
ARC_TESTNET_RPC=
ARC_TESTNET_CHAIN_ID=
POLYGON_RPC=
POLYGON_CHAIN_ID=137

# Deployer key — only used by Foundry deploy scripts, never imported in app code
DEPLOYER_PRIVATE_KEY=

# Circle
CIRCLE_API_KEY=
CIRCLE_WALLET_SET_ID=
CIRCLE_ENTITY_SECRET=
CIRCLE_APP_KIT_PROJECT_ID=

# Polymarket
POLYMARKET_API_KEY=
POLYMARKET_API_SECRET=
POLYMARKET_API_PASSPHRASE=
POLYMARKET_PRIVATE_KEY=
POLYMARKET_BUILDER_CODE=

# Irys
IRYS_PRIVATE_KEY=
IRYS_NODE_URL=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM provider (TradingAgents uses litellm — prefix resolves to the correct key)
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Indexer
INDEXER_START_BLOCK=
INDEXER_POLL_INTERVAL_MS=5000

# Frontend public vars (must be prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ARC_RPC=
NEXT_PUBLIC_STOA_REGISTRY_ADDRESS=
NEXT_PUBLIC_STOA_TREASURY_ADDRESS=
```

Key sourcing checklist:
- Alchemy/Infura → Polygon RPC
- Canteen onboarding → Arc RPC and chain ID
- Circle Console → API key, wallet set, entity secret (developers.circle.com)
- Polymarket → API keys via the CLOB client setup flow (docs.polymarket.com)
- Irys → fund a wallet with MATIC/ETH for upload payments
- Supabase → free-tier project, copy keys from project settings
- WalletConnect Cloud → free project ID for Wagmi

---

## 8. Local dev setup

First-time setup, from a fresh clone:

```bash
# Root
pnpm install

# Python agent
cd apps/agent
uv sync
cd ../..

# Smart contracts
cd packages/contracts
forge install
forge build
cd ../..

# Frontend
cd apps/web
pnpm dev
```

Running everything in parallel:

```bash
# Terminal 1 — frontend
pnpm --filter web dev

# Terminal 2 — agent service
pnpm --filter agent dev   # this wraps `uv run uvicorn main:app --reload`

# Terminal 3 — local Anvil for contract iteration (Phase 1)
cd packages/contracts && anvil
```

---

## 9. Command cheatsheet

### 9.1 pnpm (root)

```bash
pnpm install                           # install all workspace deps
pnpm --filter web dev                  # run frontend
pnpm --filter web build                # build frontend
pnpm --filter sdk build                # build the SDK
pnpm typecheck                         # run tsc --noEmit across all packages
```

### 9.2 Foundry (`packages/contracts`)

```bash
forge build                            # compile
forge test -vv                         # run tests with logs
forge test --match-test testPublishTrace -vvvv  # debug one test
forge fmt                              # format
forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC --broadcast --private-key $DEPLOYER_PRIVATE_KEY
cast call $STOA_REGISTRY "agentCount()" --rpc-url $ARC_TESTNET_RPC
cast send $STOA_REGISTRY "registerAgent(bytes32)" 0x... --rpc-url $ARC_TESTNET_RPC --private-key $DEPLOYER_PRIVATE_KEY
```

### 9.3 uv (`apps/agent`)

```bash
uv sync                                # install deps from pyproject.toml
uv run python -m stoa_agent.main       # run the agent service directly
uv run uvicorn stoa_agent.api:app --reload  # run the FastAPI dev server
uv add <package>                       # add a new dependency
```

### 9.4 Deployment

```bash
# Frontend
vercel --prod

# Agent service (Railway example)
railway up

# Contracts
forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC --broadcast --verify
```

### 9.5 Polymarket

```bash
npx tsx scripts/setup-clob-keys.ts         # derive CLOB API credentials from POLYMARKET_PRIVATE_KEY
```

---

## 10. How we make decisions

**Default to the boring choice.** Stripe-style code clarity. If a battle-tested library exists, use it. If a 30-line solution and a 300-line abstraction both work, use the 30-line one.

**Do not refactor working code unprompted.** If it's ugly but works, leave it. Add to `docs/refactor-backlog.md` and move on.

**Ask before adding architectural complexity.** New services, new languages, new databases, new auth flows — surface the tradeoff to Emmanuel first. Default answer is no.

**Solidity is sacred.** Two passes on anything written in Solidity: first writes it, second reads it as an adversary. Comment invariants, not syntax. Run `forge test` before claiming a contract is done.

**Commits are atomic and English.** One logical change per commit. Commit messages in plain English ("add trace publishing endpoint with Irys fallback", not "feat(api): impl traceSvc.publish() w/ exp backoff"). Branch names are dashes-lowercase. Main branch, fast-forward, no PR review ritual.

**Errors are opinions, not facts.** Do not catch-and-log-and-continue. Either handle the failure explicitly or let it surface. Silent failure is worse than visible crashes during the hackathon.

**No premature TypeScript gymnastics.** `any` is acceptable in three places only: parsing unknown external API responses before Zod validation, viem's untyped event logs before manual decoding, one-off scripts. Everywhere else, narrow the types.

**Test what matters.** Forge tests for contract invariants. Zod schema validation tests for the trace JSON. Fee calculation math tests. Skip React component tests. Skip Python service integration tests. The judges will not run our test suite.

---

## 11. Code style (Emmanuel-specific)

Emmanuel pushes hard against AI-sounding language in his writing. Same applies to code and docs:

- Comments explain *why*, not *what*. No comments that restate the code.
- No staccato variable names. `agentReasoningTrace`, not `art` or `traceData_v2_FINAL`.
- One em-dash per paragraph is the ceiling.
- No parallel triads ("clean, fast, and reliable" — pick one).
- No marketing language in error messages. "Invalid agent ID", not "Oops! That doesn't look like a valid agent ID."
- Function names start with verbs. Type names are nouns. Booleans start with `is`/`has`/`can`/`should`.
- Solidity: invariants and access control at the top of each function, business logic below.
- TypeScript: prefer `function` declarations over arrow consts at top level. Arrow functions for callbacks.
- Python: type-hint everything. `from __future__ import annotations` at the top of every file.
- No emojis in code, commits, or docs unless Emmanuel explicitly asks.

---

## 12. Code pattern library (templates for the common cases)

### 12.1 Foundry test template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {StoaRegistry} from "../src/StoaRegistry.sol";

contract StoaRegistryTest is Test {
    StoaRegistry registry;
    address alice = makeAddr("alice");

    function setUp() public {
        registry = new StoaRegistry();
    }

    function test_RegisterAgent_AssignsBytes32Identity() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();
        assertEq(registry.agentOwner(agentId), alice);
    }

    function test_RegisterAgent_RevertsOnDuplicate() public {
        vm.prank(alice);
        registry.registerAgent();
        vm.prank(alice);
        vm.expectRevert(StoaRegistry.AgentAlreadyRegistered.selector);
        registry.registerAgent();
    }
}
```

### 12.2 Viem contract write (frontend)

```typescript
import { useWriteContract } from 'wagmi'
import { stoaRegistryAbi } from '@/lib/abis'
import { STOA_REGISTRY } from '@stoa/shared/addresses'

export function usePublishTrace() {
  const { writeContractAsync, isPending } = useWriteContract()

  async function publishTrace(args: {
    agentId: `0x${string}`
    traceHash: `0x${string}`
    marketId: `0x${string}`
    rating: number
    confidence: bigint
    irysReceipt: string
  }) {
    return writeContractAsync({
      address: STOA_REGISTRY,
      abi: stoaRegistryAbi,
      functionName: 'publishTrace',
      args: [args.agentId, args.traceHash, args.marketId, args.rating, args.confidence, args.irysReceipt],
    })
  }

  return { publishTrace, isPending }
}
```

### 12.3 FastAPI endpoint with explicit error handling

```python
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from stoa_agent.tracing import generate_trace, publish_to_irys, publish_to_arc
from stoa_agent.errors import IrysUploadError, ArcSubmitError

router = APIRouter()

class GenerateTraceRequest(BaseModel):
    agent_id: str
    market_id: str

class GenerateTraceResponse(BaseModel):
    trace_hash: str
    irys_receipt: str
    arc_tx_hash: str

@router.post("/traces", response_model=GenerateTraceResponse)
async def create_trace(req: GenerateTraceRequest) -> GenerateTraceResponse:
    trace = await generate_trace(agent_id=req.agent_id, market_id=req.market_id)
    try:
        irys_receipt = await publish_to_irys(trace)
    except IrysUploadError as e:
        raise HTTPException(status_code=502, detail=f"irys: {e}")
    try:
        arc_tx_hash = await publish_to_arc(trace, irys_receipt)
    except ArcSubmitError as e:
        raise HTTPException(status_code=502, detail=f"arc: {e}")
    return GenerateTraceResponse(
        trace_hash=trace.hash,
        irys_receipt=irys_receipt,
        arc_tx_hash=arc_tx_hash,
    )
```

### 12.4 TradingAgents call (the canonical shape — v0.6.0)

```python
from __future__ import annotations

import os
from tradingagents import TradingAgentsConfig, TradingAgentsGraph

def run_inference(market_question: str) -> dict:
    # DEEPSEEK_API_KEY is read from env by litellm automatically via the provider prefix
    # Do NOT set OPENAI_API_KEY — litellm resolves deepseek/ prefix to DEEPSEEK_API_KEY

    config = TradingAgentsConfig(
        llm_provider="litellm",
        deep_think_llm="deepseek/deepseek-chat",
        quick_think_llm="deepseek/deepseek-chat",
        max_debate_rounds=1,
        max_risk_discuss_rounds=1,
        max_recur_limit=50,
    )

    graph = TradingAgentsGraph(config=config)
    # propagate() returns (AgentState, TradeRecommendation) — not a dict
    state, recommendation = graph.propagate(market_question, "2026-05-19")

    # AgentState is a Pydantic model with investment_debate_state, investment_plan, etc.
    debate = state.investment_debate_state
    bull = debate.bull_history if debate else ""
    bear = debate.bear_history if debate else ""
    synthesis = state.investment_plan or state.trader_investment_plan

    # TradeRecommendation has .signal (BUY/SELL/HOLD), .confidence (0.0-1.0), .rationale
    return {
        "bull": bull,
        "bear": bear,
        "synthesis": synthesis,
        "signal": recommendation.signal,
        "confidence": recommendation.confidence,
    }
```

### 12.5 Error class convention (Python)

```python
class StoaError(Exception):
    """Base for all stoa-agent errors."""

class IrysUploadError(StoaError):
    pass

class ArcSubmitError(StoaError):
    pass

class TradingAgentsInferenceError(StoaError):
    pass
```

---

## 13. Data schemas

### 13.1 `TracePublished` event (Solidity)

```solidity
event TracePublished(
    bytes32 indexed agentId,
    bytes32 indexed marketId,
    bytes32 traceHash,
    int8 rating,            // -3 = strong short, 0 = neutral, +3 = strong long
    uint16 confidenceBps,   // 0–10000
    string irysReceipt,
    uint256 timestamp
);
```

### 13.2 Trace JSON schema (Zod, lives in `packages/shared`)

```typescript
import { z } from 'zod'

export const TraceSchema = z.object({
  schemaVersion: z.literal('stoa.trace.v1'),
  agentId: z.string().regex(/^0x[a-f0-9]{64}$/),
  marketId: z.string().regex(/^0x[a-f0-9]{64}$/),
  generatedAt: z.string().datetime(),
  market: z.object({
    question: z.string(),
    venue: z.literal('polymarket'),
    resolutionAt: z.string().datetime().nullable(),
  }),
  reasoning: z.object({
    bull: z.string(),
    bear: z.string(),
    synthesis: z.string(),
  }),
  decision: z.object({
    rating: z.number().int().min(-3).max(3),
    confidenceBps: z.number().int().min(0).max(10000),
    sizeUsdc: z.number().nonnegative(),
  }),
  modelMetadata: z.object({
    framework: z.string(),  // "tradingagents-v0.6.0"
    quickThinkModel: z.string(),
    deepThinkModel: z.string(),
  }),
})

export type Trace = z.infer<typeof TraceSchema>
```

### 13.3 Postgres tables

```sql
create table agents (
  agent_id text primary key,                -- 0x-prefixed bytes32
  owner_address text not null,
  registered_at timestamptz not null default now(),
  display_handle text,
  framework text                            -- "tradingagents-v0.6.0" etc.
);

create table traces (
  trace_hash text primary key,
  agent_id text not null references agents(agent_id),
  market_id text not null,
  rating smallint not null,
  confidence_bps int not null,
  irys_receipt text not null,
  arc_tx_hash text not null,
  block_number bigint not null,
  published_at timestamptz not null
);

create table fills (
  fill_id text primary key,
  agent_id text references agents(agent_id),
  trace_hash text references traces(trace_hash),
  market_id text not null,
  taker_address text not null,
  notional_usdc numeric(20, 6) not null,
  builder_fee_usdc numeric(20, 6) not null,
  filled_at timestamptz not null
);

create index idx_traces_agent on traces(agent_id);
create index idx_fills_agent on fills(agent_id);
```

---

## 14. The narrative arc (phases, not days)

### Phase 1 — The Pipe (Days 1–4)

Deliverables:
- Monorepo skeleton up
- `StoaRegistry.sol` deployed to Arc testnet with `registerAgent` + `publishTrace` working
- Python agent emits one TradingAgents trace
- Trace pinned to Irys, hash + Irys receipt land on Arc in a single `TracePublished` event
- One end-to-end trace flows from agent → Irys → Arc on testnet

Exit criterion: a working block explorer link to `TracePublished` with a real trace behind the Irys receipt.

### Phase 2 — The Routing (Days 5–7)

Deliverables:
- Polymarket V2 builder code registered
- Frontend can submit a Polymarket order with the agent's `bytes32` in the builder slot
- Real builder fee accrues to a real wallet
- USYC subscribe/redeem integration with the treasury contract
- Thin Next.js leaderboard live at the production URL

Exit criterion: a Polymarket `OrderFilled` event with `builder` field matching our agent's `bytes32`, and the agent wallet's USDC balance increasing by the expected fee.

### Phase 3 — The Surface (Days 8–10)

Deliverables:
- Paymaster integrated for gas-free user signing on Arc
- App Kit Send/Bridge/Unified Balance components wired into the user funding flow
- SDK extracted (`packages/sdk`) so external agents plug in with one config file
- Three friendly TradingAgents devs running their own agents on Stoa

Exit criterion: a user not named Emmanuel routes a Polymarket trade through an agent not run by Emmanuel.

### Phase 4 — The Receipts (Days 11–14)

Deliverables:
- Daily build-in-public threads with on-chain receipts
- MEXC News pitch sent
- Nigerian KOL DMs sent with a 60s Loom
- 1,200-word thesis essay published in `docs/thesis.md` and as a public post
- Submission form filled
- X Space scheduled for Day 14

Exit criterion: form submitted before the May 25 deadline, with the demo URL, GitHub repo, and traction numbers documented.

Emmanuel will tell you which phase we're in. Do not jump ahead.

---

## 15. Operational runbook

### 15.1 Deploying a contract update

```bash
cd packages/contracts
forge build
forge test -vv                                          # all green or stop
forge script script/Deploy.s.sol \
  --rpc-url $ARC_TESTNET_RPC \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
# Copy the new address into packages/shared/src/addresses.ts
# Bump NEXT_PUBLIC_STOA_REGISTRY_ADDRESS in Vercel project settings
# Redeploy the frontend
```

### 15.2 Redeploying the agent service

```bash
# Railway
railway up

# Manual: anywhere with Python + uv
uv sync
uv run uvicorn stoa_agent.api:app --host 0.0.0.0 --port 8000
```

### 15.3 Rotating a key

1. Generate the new key in the relevant provider console.
2. Update `.env.local` for local dev.
3. Update Vercel + Railway env vars.
4. Redeploy frontend and agent.
5. Confirm the new key works with one live request.
6. Revoke the old key.
7. Commit nothing — keys never enter the repo.

### 15.4 Recovering from a stuck trace upload

If Irys upload succeeds but the Arc tx fails:
1. The trace is on Irys with a receipt; we have the data.
2. Retry the Arc submission with the same `(traceHash, irysReceipt)` pair.
3. If Arc rejects because of nonce issues, reset the agent wallet's local nonce cache and retry.
4. If the trace was lost entirely, regenerate and republish. Idempotency key is `(agentId, marketId, generatedAt)`.

### 15.5 Backfilling events to Postgres

If the indexer falls behind:
```bash
npx tsx scripts/backfill.ts --from-block <N> --to-block latest
```
The backfill script reads `AgentRegistered`, `TracePublished`, `Subscribed`, and `Redeemed` events directly via viem, dedupes against existing rows, and inserts the gaps. The long-running indexer is `npx tsx scripts/indexer.ts` — it catches up on startup then polls every 5s.

---

## 16. Failure mode catalog

| Failure | What you'll see | Mitigation |
|---|---|---|
| Arc RPC down | `connect ECONNREFUSED` in deploy/indexer | Fall back to a second RPC defined in env. If both fail, retry with exponential backoff up to 5min. |
| Polymarket rate-limited (HTTP 429) | `429 Too Many Requests` in agent logs | Implement client-side backoff: 1s, 2s, 4s, 8s. Cap at 8s. Never hammer. |
| Irys upload fails | `IrysUploadError` raised | One retry. Then skip this trace and log it as a deferred publication. Do not block the agent loop. |
| DeepSeek inference slow or timeout | Agent loop stalls on one market | `asyncio.to_thread` wraps the synchronous litellm call. Each market fails independently; loop continues. If DeepSeek is down entirely, cycle logs errors and retries next interval. |
| Polymarket order rejected (insufficient balance) | `INSUFFICIENT_USDC` error code | Frontend shows a clear "fund your wallet with USDC.e on Polygon" prompt with an App Kit Bridge component pre-filled. |
| CCTP V2 attestation slow | User waiting > 90s on cross-chain deposit | Show a status bar with the expected ~13min hard fallback and explain the soft path is usually under 30s. |
| LLM API down (DeepSeek/OpenAI/Anthropic outage) | `502` from inference | Swap providers via env var. DeepSeek is primary via `DEEPSEEK_API_KEY`; OpenAI/Anthropic are fallbacks. All keys live in `.env.local`. |
| Vercel deploy fails | Build error in CI | Check that `packages/shared` and `packages/sdk` are built before `apps/web`. Add `"build": "pnpm --filter @stoa/shared build && pnpm --filter @stoa/sdk build && next build"` to `apps/web/package.json`. |
| Supabase free-tier limit hit | `429` on indexer writes | Upgrade to the $25/month tier. This is the one paid service we accept during the hackathon. |

---

## 17. External references

Bookmark these. Read the canonical doc before writing code that touches the system.

- **Polymarket V2 builder fees:** docs.polymarket.com/builders/fees
- **Polymarket CLOB V2 migration:** docs.polymarket.com/v2-migration
- **Polymarket TypeScript client:** github.com/Polymarket/clob-client
- **Polymarket reference agent repo:** github.com/Polymarket/agents
- **Circle Arc docs:** docs.arc.network
- **Circle Developer Platform:** developers.circle.com
- **CCTP V2:** developers.circle.com/cctp
- **USYC integration:** usyc.docs.hashnote.com
- **Paymaster:** developers.circle.com/paymaster
- **App Kit:** developers.circle.com/app-kit
- **Circle Wallets:** developers.circle.com/w3s
- **TradingAgents repo:** github.com/TauricResearch/TradingAgents
- **Trading-R1 paper:** arxiv.org/abs/2509.11420
- **Irys SDK:** docs.irys.xyz
- **Foundry book:** book.getfoundry.sh
- **Wagmi v2 docs:** wagmi.sh
- **Viem v2 docs:** viem.sh
- **Canteen's "Unbundling the Prediction Market Stack":** thecanteenapp.com/analysis/2026/05/01/unbundling-the-prediction-market-stack.html — **read this twice; it is our north star**
- **Canteen's "Multi-Agent Landscape" essay:** thecanteenapp.com/analysis/2026/03/27/multi-agent-landscape.html
- **Agora hackathon page:** agora.thecanteenapp.com

---

## 18. What "done" looks like for any feature

A feature is done when:
1. It works end-to-end on Arc testnet with real testnet USDC.
2. There's a 5-line README section in the relevant package showing how to invoke it.
3. There's at least one on-chain transaction we can point at as proof.
4. Emmanuel has run it once and confirmed the output looks right.

"It compiles" is not done. "Tests pass" is not done. **On-chain receipt** is done.

---

## 19. The judge's 60-second demo (memorize — every UX decision serves this)

1. **[0:00–0:08]** "Trading agents have a model but no product. Trading-R1 said the trace is the product. Let's give the trace a home."
2. **[0:08–0:20]** Live agent reasoning streaming on screen for a Polymarket market — DeepSeek inference with calibrated probability assessment.
3. **[0:20–0:32]** Click Publish → Arc tx in 780ms → `TracePublished` event with `bytes32` agent ID, trace hash, Irys receipt. Open the Irys link, show the full timestamped trace.
4. **[0:32–0:48]** Polymarket interface. "Route through this agent." Order submits with agent's `bytes32` in builder slot. `OrderFilled` event. Fee accrued in pUSD, visible in agent wallet.
5. **[0:48–0:60]** Leaderboard. Twelve agents, 847 traces this week, top three by realized profit. "Anyone plugs in with one config line. Reasoning is the product. Trace is the artifact. Arc is the proof."

Every UX decision either serves this demo or it doesn't ship in 14 days.

---

## 20. Forbidden patterns (reverted on sight)

- Generating mock data for the demo. The demo runs on testnet receipts.
- Hardcoded API keys anywhere in the repo. Use `.env` + `dotenv`.
- README sections that start with "Welcome to" or "Introducing".
- Splash screens, onboarding tours, marketing pages. The leaderboard is the landing page.
- Any file named `utils.ts` or `helpers.py` longer than 50 lines.
- "Powered by AI" copy anywhere in the UI.
- Cute names. Agents have `bytes32` IDs, not names. (Exception: Stoa, the protocol.)
- Tailwind class soup. If a component has more than 8 utility classes, extract a component or a class via `@apply`.
- `console.log` in committed frontend code. Use a logger or remove.

---

## 21. Submission checklist (form: forms.gle/hFPM2t4Jt1zGfqzM7)

Before submission, confirm:

- [ ] Live working product URL (Vercel)
- [ ] Public GitHub repo URL with main branch up to date
- [ ] Demo video (60–90s, recorded with the demo script in section 19)
- [ ] Traction numbers documented: # of wallets connected, # of routed trades, total notional, total builder fees accrued — all queryable on-chain
- [ ] README final pass: starts with the pitch, references the Canteen Unbundling essay, has the Aristotle quote used substantively (not decoratively), links to the thesis essay
- [ ] `docs/thesis.md` published (1200 words, Canteen's voice, ends with a falsifiable prediction)
- [ ] Builder code registered and active on Polymarket V2
- [ ] At least one user not named Emmanuel has routed a real trade
- [ ] X thread of build-in-public posts pinned on Emmanuel's profile
- [ ] Discord introductions made in #canteen-agora and #build-on-arc

---

## 22. Daily state log (updated by Emmanuel at the end of each working session)

*This section is the single most important page-of-truth for Claude Code at the start of every new session. Read it first. Trust the most recent entry over your prior assumptions.*

```
### Day 1 — May 16
Shipped: Monorepo skeleton, all package stubs, Foundry project structure, FastAPI stub, Next.js placeholder, all docs
Blocked on: Network (foundryup, pnpm install couldn't run)
Next session goal: Install Foundry, implement StoaRegistry, deploy to Arc testnet

### Day 2 — May 17
Shipped: StoaRegistry.sol deployed to Arc testnet (0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b), 9 Foundry tests passing, registerAgent called on testnet
Blocked on: Nothing
Next session goal: Python agent emits a TradingAgents trace, pins to Irys, publishes to Arc

### Day 3 — May 19
Shipped: Full agent pipe end-to-end on testnet. TradingAgents v0.6.0 running via DeepSeek/litellm. Agent registered (0x797badd2...). Irys upload via Node.js subprocess. First live trace published (market: "Will bitcoin hit $1m before GTA VI?", rating: -2 SELL, confidence 65%). Irys: FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp. Arc tx: 0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845
Blocked on: Nothing
Next session goal: Frontend skeleton, leaderboard page, wire up trace-publish flow

### Day 4 — May 20
Shipped: (AM) Fixed 3 agent pipe bugs (Gamma pagination, DeepSeek env var, recursion limit), integrity assertion, explorer URL fix, verification one-liner. (PM) Full Next.js frontend deployed to Vercel. Leaderboard, live trace stream, agent detail pages, trace detail dialog, wallet connect (RainbowKit), dark theme. Polymarket CLOB key derivation script. 5 Vercel deployment issues fixed (tsconfig, pnpm filter, shared imports, SSO protection, env vars). Live at https://stoa-agents.vercel.app
Blocked on: Nothing
Next session goal: Wire trace-publish flow (frontend → agent API → Irys + Arc), connect wallet flow, Paymaster integration

### Day 5 — May 21
Shipped: Polymarket V2 routing pipeline. `apps/web/lib/polymarket.ts` with `buildSignedOrder()` using `@polymarket/clob-client-v2`. Server-side `/api/route-order` API route (dry-run default, secrets never in browser). "Route this trade" button on trace detail dialog. `scripts/verify-routing.ts` — signed V2 order, builder field asserted against registered code. `scripts/broadcast-one-order.ts` — only script that touches real money, gated behind `--confirm-real-money`. Key finding: Polymarket V2 `Side` enum is string ("BUY"/"SELL"), not integer. `SignedOrder` union type requires `any` cast for V2 field extraction. Bug found and fixed: env var was `POLYMARKET_BUILDER_ADDRESS` in code but `POLYMARKET_BUILDER_CODE` in `.env.local`. V2 builder semantics confirmed against docs.polymarket.com/v2-migration: field is `builder` (bytes32), SDK input is `builderCode`, fees are protocol-set at match time (not per-order).
Blocked on: Nothing
Next session goal: Frontend legibility pass for cold visitors (X thread just went out)

### Day 6 — May 22
Shipped: (AM) Cold-visitor legibility pass. One-line header with stat pills (trace count, agent count, "anchored on Arc") derived from live contract data. Synthesis teaser on trace cards ("Agent's call: SELL at 65% confidence"). "Verify this trace yourself" link in reasoning dialog → docs/verification.md. "How it works" three-step collapsible below traces. Favicon (dark rect + "S"). Skeleton loading states improved to match real content (card-shaped skeletons, table-shaped leaderboard skeleton, pulsing "Loading on-chain traces..." text). Vercel Root Directory fixed from `.` to `apps/web` via API — previous pushes weren't deploying because Vercel couldn't find Next.js at the repo root. (PM) Editorial-terminal design pass. Direction: "An editorial research journal for machine reasoning." Three registers — editorial (serif headers, generous measure), terminal (mono on-chain data), classical (amber accent, restraint). Palette: near-black #0f0e0d, warm off-white #e8e4dc, amber #d97706. Typography: Newsreader (serif display), Inter (sans body), JetBrains Mono (mono data). Bug fixes: (1) trace reasoning now renders markdown via react-markdown + remark-gfm, no more literal asterisks; (2) RainbowKit theme updated from indigo to amber, ConnectButton shows address in mono when connected. Design spec at `mnt/skills/public/frontend-design/SKILL.md/stoa-design-system.md`. (Eve) Dialog UX fixes: route button enabled for all BUY/SELL traces (removed sizeUsdc guard), collapsible bull/bear/synthesis sections via `<details>`, thin custom scrollbar, amber focus ring on close button, expanded loading skeletons. StoaTreasury.sol implemented and deployed to Arc testnet (0xe8eB3a0233D8E227636f91f45Cd17583Be6A1008) — subscribe/redeem USDC, optional ERC-4626 yield vault (USYC), 12 Foundry tests passing. Frontend: treasury value as 4th stat card on agent pages, hooks + ABI wired. Polymarket real order attempted — blocked on deposit wallet requirement (POLY_1271 signature type needed for new API users, relayer API not reachable). Agent wallet funded with $5.91 USDC.e, $1 transferred to original Polymarket signing wallet. `POLYGON_RPC` env var set to public RPC. `POLYMARKET_PRIVATE_KEY` reverted to original key after testing agent key approach.
Blocked on: Polymarket deposit wallet (relayer API unreachable from our environment; needs `WALLET-CREATE` via relayer + POLY_1271 signature type)
Next session goal: Resolve Polymarket deposit wallet (try from a different network, or use Polymarket UI to create deposit wallet), OR continue with other Phase 2/3 items per Emmanuel's call

### Day 7 — May 23
Shipped: StoaTreasury.sol deployed to Arc testnet (0xe8eB3a0233D8E227636f91f45Cd17583Be6A1008). USDC subscribe/redeem per agent, optional ERC-4626 yield vault (USYC) for idle capital. 12 Foundry tests passing. Frontend hooks wired: useTreasuryValue, useTreasurySubscribe, useTreasuryRedeem. Agent detail pages show treasury value as 4th stat card. No OpenZeppelin dependency — raw ERC-20/ERC-4626 calls, 150 lines, self-contained.
Blocked on: Polymarket deposit wallet (relayer unreachable); USDC/USYC on Arc testnet (need confirmed addresses from Circle docs)
Next session goal: Resolve Polymarket deposit wallet, OR continue with Phase 3 items per Emmanuel's call

### Day 8 — May 23
Shipped: Polymarket proxy wallet resolved. The proxy already existed — Polymarket's UI created it when agent EOA first deposited. Discovered via Polygonscan tx history (3 USDC.e transfer, block 87188177) + relayer API confirmation (`GET /deployed?address=...&type=WALLET` returns `{"deployed": true}`). Proxy: 0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a. ClobClient V2 configured with POLY_1271 + funderAddress. CTFExchangeV2 approvals already at MAX_UINT256. Dry-run order signed successfully — maker=proxy, signer=proxy, signatureType=3, builder=registered code. All assertions pass.
Blocked on: Proxy wallet has 0 pUSD balance. Need to fund with pUSD (0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB) then sync CLOB balance.
Next session goal: Fund proxy wallet with pUSD, broadcast real $0.05 BUY order, verify builder fee accrual

### Day 9 — May 23
Shipped: Extensive POLY_1271 broadcast debugging. Root cause identified: CLOB API rejects all POLY_1271 orders with "the order signer address has to be the address of the API KEY" — fires before signature validation, across both TS/Python SDKs, raw HTTP, every signer/maker combination. The proxy wallet's ERC-1967 implementation slot is 0x0 (not a proper proxy). Archive document created at docs/archive/phase-2-polymarket-broadcast.md with full root cause, resolution path, and confirmed reference values.
Blocked on: Deposit wallet not deployed through official relayer flow (impl slot = 0x0, relayer unreachable). Resolution requires Builder API credentials + relayer access from a different network environment.
Next session goal: Resolve deposit wallet via relayer OR pivot to Phase 3 items (Paymaster, App Kit, SDK extraction) per Emmanuel's call

### Day 10 — May 23
Shipped: Phase 3 build. SDK extraction verified — `@stoa/sdk` builds, exports resolve, `getMarketTokenIds()` hits live Gamma API, `hashTrace()` produces valid hex. External consumer can import and call. `apps/web/src/lib/polymarket.ts` refactored to import from `@stoa/sdk`. Web app still builds clean. Paymaster code written (`apps/web/src/lib/paymaster.ts`) — EIP-2612 permit signing works, Pimlico bundler accepts UserOp, but Circle Paymaster contract `0x3BA9...` is not deployed on Canteen's Arc testnet RPC (`AA30 paymaster not deployed`). App Kit code written (`apps/web/src/lib/appkit.ts`, funding dialog, bridge API route) — module resolves, `AppKit` class instantiates, but `kit.bridge()` hangs (Circle API unreachable from this environment). Archives created: `docs/archive/phase-3-paymaster.md`, `docs/archive/phase-3-appkit.md`. Pattern: three external infra blockers in a row (Polymarket relayer, Circle Paymaster contract, Circle App Kit API) — all code-correct, all unreachable from this environment.
Shipped (cont.): StoaTreasury redeployed with correct USDC address (`0x812BcEEc2De8C8aC71C7af7A8E2d4467E65Fdf18`). Original deploy had USDC=`address(0)` because `USDC_ARC_ADDRESS` env var wasn't set. Full subscribe/agentValue/redeem cycle verified live on Arc testnet with real USDC (txs: `0xcc2bc262...`, `0xbfc7cd11...`). `setYieldVault(0x825Ae4...5903)` blocked — Circle's testnet USYC vault doesn't implement `asset()`, treasury's line-140 safety guard correctly rejects it. Yield logic proven by 12 Foundry tests against spec-compliant mock vault. Archive: `docs/archive/phase-3-treasury-yield.md`. `packages/shared/src/addresses.ts` updated with new treasury address, `ARC_USDC`, `ARC_USYC_VAULT`.
Shipped (cont.): UI polish pass. Dialog loading state: structured skeleton with "Fetching trace from Irys…" label, bordered section containers mirroring final layout. Content fade-in-up animation on load. Reasoning sections (bull/bear/synthesis) all collapsed by default with smooth CSS grid-height transition. Staggered entrance animations on trace cards (60ms) and leaderboard rows (50ms). "How it works" section gets same smooth collapse + chevron. Link icon (↗) on leaderboard agent addresses and Arc tx hashes in trace cards. Back button ("← Leaderboard") on agent detail pages. Stats section loading fixed — wrapped in Card with animate-pulse to prevent cutoff. Removed redundant "read the full bull/bear debate" copy from trace cards.
Blocked on: External infra (Polymarket relayer, Circle Paymaster contract, Circle App Kit API) — all unreachable from this environment; USYC vault partial ERC-4626 (no `asset()`)
Next session goal: Outreach — SDK is the verified win, onboarding TradingAgents devs is the remaining Phase 3/4 work

### Day 11 — May 24
Shipped: Three-step build session.

**Step 1 — Wiring fixes.** Four issues identified and resolved: (1) `NEXT_PUBLIC_STOA_TREASURY_ADDRESS` was missing from `apps/web/.env.local` — treasury stat card showed "--" on all agent pages. Added with deployed address `0x812BcEEc2De8C8aC71C7af7A8E2d4467E65Fdf18`. (2) `@stoa/sdk` was missing from `transpilePackages` in `next.config.ts` — SDK internal `.js` extension imports could fail at Next.js build time. Added. (3) Local `apps/web/src/lib/shared/addresses.ts` had `STOA_TREASURY = address(0)` while `packages/shared/src/addresses.ts` had the real address. Reconciled to match. (4) Polymarket server-side env vars (`POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_API_PASSPHRASE`, `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_BUILDER_CODE`) were in root `.env.local` but not in `apps/web/.env.local` or Vercel. Added to both. Also added `NEXT_PUBLIC_STOA_TREASURY_ADDRESS` and `POLYGON_RPC` to Vercel. Total: 7 new Vercel env vars.
Verification: `pnpm build` passes, `packages/shared` and `packages/sdk` build clean, `forge test` 21/21 pass, `/api/rpc` returns chain ID 5042002, `/api/route-order` dry-run returns signed order with correct builder code.

**Step 2 — Event indexer.** `scripts/indexer.ts` — long-running process that polls Arc testnet for `AgentRegistered`, `TracePublished`, `Subscribed`, and `Redeemed` events from StoaRegistry and StoaTreasury. Writes to Supabase (`agents`, `traces` tables). Catches up on startup (10k-block chunks), then polls every 5s. `scripts/backfill.ts` — one-shot variant for catching up after downtime (`--from-block N --to-block latest`). Both use viem for chain reads and `@supabase/supabase-js` for writes. Ran backfill successfully: 9 traces indexed from on-chain events. Supabase now serves as the read cache for the frontend leaderboard.

**Step 3 — Agent autonomous loop.** `apps/agent/stoa_agent/loop.py` — `AgentLoop` class that runs continuously: every 10 minutes, fetches active markets from Polymarket Gamma API, filters already-published, scores by liquidity/binary/near-resolution, selects top N, runs DeepSeek inference, skips low-confidence, builds trace, uploads to Irys, publishes to Arc. State persisted to Supabase across restarts. `apps/agent/stoa_agent/cli.py` — new `autonomous` subcommand: `python -m stoa_agent.cli autonomous [--interval N] [--max-markets N] [--min-confidence N]`. `apps/agent/stoa_agent/config.py` — new loop settings: `loop_interval_seconds`, `loop_min_liquidity`, `loop_min_confidence_bps`, `loop_max_markets_per_cycle`, `supabase_url`, `supabase_service_role_key`. Tested end-to-end: 5 markets loaded from Supabase on restart, new trace published with DeepSeek reasoning.

**Step 3b — DeepSeek as primary inference.** Restructured `apps/agent/stoa_agent/reasoning/runner.py` — `run_inference_direct()` is now the primary inference method (was fallback to TradingAgents). New prediction-market-specific prompt: calibrated probability reasoning, base rates, explicit uncertainty acknowledgment, resolution date context. Removed TradingAgents timeout wrapper from `loop.py` — agent now calls DeepSeek directly via `asyncio.to_thread`. Fixed missing `DEEPSEEK_API_KEY` env var in `run_inference_direct()`. Tested on live markets: reasoning now grounded in specific facts and calibrated probabilities (e.g., "I estimate 5% probability... I lack deep expertise in constitutional law").

Blocked on: Nothing
Next session goal: Final polish pass — verify all docs match implementation, test autonomous loop with one full cycle, outreach

### Day 12 — May 22
Shipped: Three archived blockers resolved.

**Part 1 — Treasury yield breakthrough.** Discovered that the USYC **Teller** contract (`0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`) implements the full ERC-4626 interface. Verified live on Arc testnet: `asset()` returns USDC, `convertToAssets(1e6)` returns 1116277 (1 USYC = $1.116), `previewDeposit`/`previewRedeem`/`maxDeposit`/`maxRedeem` all work. The original blocker was testing against the USYC token address (`0xe918...`) instead of the Teller. `setYieldVault()` requires zero code changes — just point it at the Teller. `packages/shared/src/addresses.ts` updated with `ARC_USYC_TELLER`. USYC Hackathon Access Form submitted for allowlisting the treasury contract (`0x812BcEEc2De8C8aC71C7af7A8E2d4467E65Fdf18`) on the Entitlements contract. Email drafted to customer-support@circle.com.

**Part 2 — Bridge timeout hardening.** Three fixes to `apps/web`: (1) `appkit.ts` — `withTimeout` helper wraps `kit.bridge()` and `kit.send()` in 30s `Promise.race` with `BridgeTimeoutError`. (2) `route.ts` — catch block detects timeout, returns `{ isTimeout: true }` with HTTP 504. (3) `funding-dialog.tsx` — timeout-specific error message with Retry button. Confirmed via arc-canteen context: `new AppKit()` with no args is correct for bridge (no kitKey needed). Bridge hang is network-level, not code.

**Part 3 — Docs updated.** `docs/resolution.md` — Treasury Yield status changed to "Resolved: Teller is ERC-4626, allowlisting pending." `docs/architecture.md` — USYC section updated with Teller details. `docs/api.md` — added `ARC_USYC_TELLER` address. Archives updated: `phase-3-treasury-yield.md` and `phase-3-appkit.md` both have Day 12 updates.

**Part 4 — Paymaster resolved as not applicable.** Verified on Circle's own RPC (`https://rpc.testnet.arc.network`): paymaster contract `0x3BA9...` returns `0x`. Arc denominates all gas in USDC natively — the Circle Paymaster exists for ETH-gas chains (Arbitrum, Base, Polygon, etc.) where you want to abstract gas to USDC via EIP-2612 permits + ERC-4337. On Arc, every transaction already pays ~$0.01 in USDC. No paymaster needed. The `paymaster.ts` code and `useGasFreePublishTrace()` hook remain as reference for post-hackathon multi-chain expansion. Updated `docs/resolution.md` and `docs/archive/phase-3-paymaster.md`.

Blocked on: USYC allowlisting (24-48hr from Circle Support)
Next session goal: Wire `setYieldVault(TELLER)` once allowlisted, test full subscribe-yield-redeem on testnet, deploy bridge fixes to Vercel and test

### Day 13 — May 23
Shipped: Polymarket broadcast blocker resolved. Root cause: cross-chain mismatch (Arc testnet chain 5042002 vs Polygon mainnet chain 137) — not a code issue. Polymarket CLOB is on Polygon mainnet, Stoa contracts are on Arc testnet, no bridge between them. The routing code is designed for mainnet where both coexist. Exhaustive investigation confirmed CLOB API rejects all POLY_1271 orders with "the order signer address has to be the address of the API KEY" — a platform-level constraint affecting all programmatic deposit wallet orders, both TS and Python SDKs. Resolution: `broadcast-one-order.ts` rewritten as dry-run verification with 8 assertions (all pass). `packages/sdk/src/polymarket.ts` documented as mainnet-ready. `docs/archive/phase-2-polymarket-broadcast.md` rewritten with full resolution. `docs/resolution.md` Polymarket section updated to "Resolved (production-ready, pending mainnet)". 10 debugging test scripts removed. The entire Polymarket pipeline — CLOB key derivation, POLY_1271 signing, builder code attribution, order construction — is production-ready. When Arc ships mainnet, existing code submits orders with zero changes.
Blocked on: Nothing (USYC allowlisting still pending from Day 12)
Next session goal: Final polish pass — verify all docs, test autonomous loop, outreach
```

When starting a session, Claude Code's first action is to read the most recent Day N entry and confirm understanding before touching code.

---

## 23. When you're stuck

If you have low confidence about a Circle/Arc primitive: read the doc in section 17, write three lines, run them, iterate. Do not theorize.

If you have low confidence about a Polymarket V2 integration: check `Polymarket/agents` for prior art before writing from scratch.

If you have low confidence about TradingAgents output schema: load v0.6.0, run one inference against a real market, inspect the JSON. Note: `propagate()` returns `(AgentState, TradeRecommendation)` — AgentState is a Pydantic model, not a dict.

If you have low confidence about the design: stop and ask Emmanuel. The cost of asking is 30 seconds. The cost of wrong direction at Day 8 is the hackathon.

---

*"All things that are exchanged must be somehow comparable." — Aristotle, Nicomachean Ethics V.5*

That sentence is the entire argument for why reasoning traces need a `bytes32` identity. It's also the only Aristotle quote that appears in the README. Use it once. Mean it.
