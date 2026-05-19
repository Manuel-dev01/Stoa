# Day 3 — May 19

## What shipped

The full agent pipe works end-to-end on testnet:

1. **TradingAgents v0.6.0 installed and running.** The API changed significantly from v0.2.4 documented in CLAUDE.md — `TradingAgentsConfig` is now a Pydantic model, `propagate()` returns `(AgentState, TradeRecommendation)` not a dict + string, and the LLM provider is `litellm` (not `openai` with a custom backend_url). DeepSeek works via `litellm` with the `deepseek/deepseek-chat` model prefix.

2. **Agent registered on Arc testnet.** Agent ID: `0x797badd2de144db6311a1f0f79a2d3e544021a003c7e96544cbc5441901e6be7`. ABI fix needed: web3.py requires `"anonymous": false` on event definitions.

3. **Polymarket Gamma API client working.** The `outcomes` field comes back as a JSON string, not a list — added a Pydantic `field_validator` to parse it. Single-market fetch uses the list endpoint with `condition_id` param (the `/markets/{id}` endpoint expects a numeric ID, not the conditionId).

4. **Irys upload working via Node.js subprocess.** No Python SDK exists for Irys. The HTTP API requires ANS-104 data items. Solution: a `scripts/irys_upload.mjs` script using `@irys/sdk` (NodeIrys) that reads JSON from stdin and returns the receipt ID. Devnet requires `providerUrl` (Polygon Amoy RPC) in the config.

5. **First trace published on-chain.**
   - Market: "Will bitcoin hit $1m before GTA VI?" (`0xbb57ccf5...`)
   - Rating: -2 (SELL), Confidence: 65%
   - Irys receipt: `FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp`
   - Arc tx: `0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845`
   - Trace hash: `0xd8ad17367fcc9e4e65c083e2be2af0d33e26e81326c59b22b1082001082109f1`
   - Verified: keccak256 of canonicalized Irys JSON matches on-chain traceHash.

## Deviations from CLAUDE.md

- **TradingAgents version:** v0.6.0, not v0.2.4. The `propagate()` API, config structure, and state shape are all different. The runner adapts to both the old dict-based and new Pydantic-based state.
- **LLM provider:** `litellm` with `deepseek/deepseek-chat` prefix, not `openai` with `backend_url`. The `backend_url` config key doesn't exist in v0.6.0.
- **Irys upload:** Node.js subprocess via `@irys/sdk`, not a Python HTTP client. The HTTP `/tx/data` endpoint rejects raw JSON ("Invalid DataItem").

## What's next (Day 4)

- Frontend skeleton (Next.js 15, App Router, shadcn/ui)
- Leaderboard page reading from Arc events
- Wire up the trace-publish flow from the frontend

## Receipts

- Agent registered: `0x797badd2de144db6311a1f0f79a2d3e544021a003c7e96544cbc5441901e6be7` on Arc testnet block 42937683
- Trace published: `0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845`
- Irys: https://devnet.irys.xyz/tx/FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp
