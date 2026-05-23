# @stoa/agent

Python agent service for Stoa. Runs DeepSeek inference on Polymarket markets, publishes reasoning traces to Irys and Arc.

## Stack

- Python 3.12+, `uv` for dependency management
- DeepSeek via `litellm` (primary inference engine)
- FastAPI for trace-publication endpoints
- Polymarket Gamma API (`httpx`) for market data
- Irys upload via Node.js subprocess (`scripts/irys_upload.mjs`)
- web3.py + eth-account for Arc chain interaction
- Supabase for state persistence across restarts

## Quickstart

```bash
uv sync
cp .env.example .env.local  # fill in your keys

# Register an agent on Arc testnet
uv run python -m stoa_agent.cli register

# Publish a single trace
uv run python -m stoa_agent.cli publish-trace --market-id 0x<condition_id>

# Run the autonomous loop
uv run python -m stoa_agent.cli autonomous --interval 600 --max-markets 3 --min-confidence 5000
```

## Run the API server

```bash
uv run uvicorn stoa_agent.api:app --reload
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `register` | Register a new agent on StoaRegistry. Prints the `agent_id` (bytes32). |
| `publish-trace --market-id 0x...` | Full pipeline: fetch market, run inference, upload to Irys, publish to Arc. |
| `autonomous` | Continuous loop: poll markets, run DeepSeek inference, publish traces. |
| `circle-setup [--agent-id 0x...]` | Create a Circle wallet for agent treasury management. |
| `circle-balance` | Check USDC balance of the Circle wallet. |
| `circle-treasury --agent-id 0x...` | Read agent's treasury value and shares. |
| `circle-subscribe --agent-id 0x... --amount N` | Deposit USDC into agent's treasury. |
| `circle-redeem --agent-id 0x... --shares N` | Redeem shares from agent's treasury. |

## Configuration

All configuration via environment variables (see root `.env.example`). Key variables:

- `DEEPSEEK_API_KEY` — DeepSeek API key (via litellm, resolves `deepseek/` prefix automatically)
- `AGENT_PRIVATE_KEY` — EOA private key for Arc transactions
- `IRYS_PRIVATE_KEY` — private key for Irys uploads
- `ARC_TESTNET_RPC` — Arc testnet RPC URL
- `STOA_REGISTRY_ADDRESS` — deployed StoaRegistry address
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — for state persistence across restarts

See [`docs/api.md`](../../docs/api.md) for the full environment variable reference.

**Node.js dependency:** Irys uploads require Node.js at runtime. The agent shells out to `scripts/irys_upload.mjs` (using `@irys/sdk`) because no maintained Python SDK exists for Irys ANS-104 data items. Ensure `node` is on PATH and `npm install` has been run in `apps/agent/`.

## Autonomous Loop

The `AgentLoop` class in `loop.py` runs continuously:

1. Fetches active markets from Polymarket Gamma API
2. Filters already-published markets (state in Supabase)
3. Scores by liquidity, binary format, and resolution proximity
4. Runs DeepSeek inference with calibrated probability prompt
5. Skips traces below confidence threshold
6. Uploads to Irys, publishes to Arc
7. Sleeps for the configured interval, then repeats

State persists to Supabase across restarts. The loop rehydrates its published-market-ID set on startup.

## Inference

Primary method: `run_inference_direct()` in `reasoning/runner.py`. Calls DeepSeek via `litellm` with a prediction-market-specific prompt that asks for calibrated probability reasoning, base rates, and explicit uncertainty acknowledgment.

TradingAgents v0.6.0 is available as an optional dependency but is not used by the autonomous loop (hangs on yfinance for non-stock prediction market tickers). `run_inference()` exists for backward compatibility.

## Tests

Skip them for hackathon scope. The end-to-end test is "publish one trace and see it on [arcscan](https://testnet.arcscan.app)."

## See also

- [`/docs/api.md`](../../docs/api.md) — full API reference
- [`/docs/integration.md`](../../docs/integration.md) — how external agents plug in
- [`/docs/architecture.md`](../../docs/architecture.md) — system diagram
