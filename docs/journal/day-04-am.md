# Day 4 (AM) — May 20, 2026

**Phase:** 1 of 4 (The Pipe)

## What shipped

- Documentation fully reconciled with Day 3 implementation deviations (commit `4cb774e`)
- Updated CLAUDE.md: §5.4 (agent stack), §5.5 (Irys subprocess note), §7 (env vars with `DEEPSEEK_API_KEY`), §12.4 (canonical TradingAgents pattern with `DEEPSEEK_API_KEY`), §16 (failure mode table)
- Updated `docs/architecture.md`: Irys paragraph reflects Node.js subprocess approach
- Updated `apps/agent/README.md`: Node.js dependency note, `DEEPSEEK_API_KEY` config
- Updated `README.md`: full agent ID, status bump to Day 4, on-chain receipts with real values

## Smoke test results

Attempted to publish traces to two additional Polymarket markets to confirm pipeline stability. Both runs failed.

### Failure 1: Gamma API `condition_id` filter is broken

`get_market()` in `stoa_agent/polymarket/gamma.py` passes `condition_id` as a query param to the Gamma API list endpoint (`/markets?condition_id=...&limit=1`). The API ignores the filter and returns the first market in its default ordering. Every call to `publish-trace` fetches the same market regardless of the `--market-id` argument.

**Root cause:** The Gamma API `/markets` endpoint does not support `condition_id` as a filter param. The client needs to fetch all active markets and filter client-side, or find a working endpoint.

**Impact:** The CLI always infers on the wrong market. Day 3's BTC trace was correct only because "Will bitcoin hit $1m before GTA VI?" happened to be first in the API's default ordering at that time.

### Failure 2: DeepSeek 600s timeout on TradingAgents prompts

All three attempts failed with `litellm.Timeout: Connection timed out after 600.0 seconds`. Direct DeepSeek API tests work fine:
- Short prompt (6 tokens): 2s
- Medium prompt (105 tokens): 16s
- Long prompt (2017 tokens): 15s

The timeout is specific to TradingAgents' multi-agent pipeline calls via litellm. Possible causes:
1. TradingAgents makes many sequential LLM calls (researcher, trader, risk, portfolio manager). One specific call may have a very long prompt (>5000 tokens).
2. litellm's default timeout (600s) may be too aggressive for the full pipeline.
3. DeepSeek may rate-limit or throttle long-context requests differently than short ones.

**Not yet investigated:** Whether setting `timeout` in `TradingAgentsConfig` or via litellm environment variables would help. Whether the `OPENAI_API_KEY` substitution on line 44 of `runner.py` causes litellm to route through OpenAI's proxy instead of directly to DeepSeek.

## What's next

Both blockers need fixing before the smoke test can succeed:
1. Fix `gamma.py` to filter markets client-side (fetch all, match by condition_id)
2. Investigate DeepSeek timeout — try `litellm.request_timeout=900` env var, check if the `OPENAI_API_KEY` substitution in `runner.py` line 44 interferes with litellm's DeepSeek routing

## Receipts

- Doc reconciliation commit: `4cb774e`
- Pushed to: `master` on `github.com/Manuel-dev01/Stoa`
