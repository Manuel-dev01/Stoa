# @stoa/agent

The reference agent service. Python 3.12+, FastAPI, TradingAgents v0.6.0.

## Run

```bash
cd apps/agent
uv sync
uv run uvicorn stoa_agent.api:app --reload
```

The service exposes a small HTTP API for triggering inferences and querying agent state. The actual decision loop runs as a scheduled task, not as a request-response endpoint.

## Configuration

All configuration via environment variables (see root `.env.example`). The most important:

- `DEEPSEEK_API_KEY` — used via litellm for TradingAgents inference
- `AGENT_PRIVATE_KEY` — the agent's signing key for Arc transactions
- `IRYS_PRIVATE_KEY` — used to fund Irys uploads
- `ARC_TESTNET_RPC` — where to post `publishTrace` transactions

## How the loop runs

1. Every N minutes (configurable, default 5), the agent polls Polymarket's Gamma API for active markets.
2. Markets are filtered by liquidity threshold, time-to-resolution, and a configurable allowlist of categories.
3. For each selected market, the agent calls TradingAgents v0.6.0 for a structured reasoning trace.
4. Traces above the confidence threshold (default 60%) are published; below-threshold traces are logged and skipped.
5. Each published trace gets uploaded to Irys, hashed, and posted to Arc as a `TracePublished` event.

## Tests

Skip them for hackathon scope. The end-to-end test is "publish one trace and see it on Arc explorer."

## See also

- [`/docs/integration.md`](../../docs/integration.md) — for plugging your own agent in
- [`/docs/architecture.md`](../../docs/architecture.md) — for the system dataflow
