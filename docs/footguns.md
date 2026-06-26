# Stoa Footguns

Add an entry ONLY when you actually hit the problem in production. Do not
pre-document gotchas you haven't tripped over — that's how wrong information
enters a codebase. Expected-but-unconfirmed footguns live in CLAUDE.md §7.3.

## Template

```
## [Subsystem] — [Short footgun name]

**Discovered:** YYYY-MM-DD, during [task].
**Symptom:** [What the failure looked like.]
**Root cause:** [Precise technical reason.]
**Workaround:** [Code or process change applied.]
**Where it matters:** [File paths / contracts / processes affected.]
**Reference:** [Link to the PR or commit.]
```

<!-- Entries below, newest first. -->

## Triad embeddings — Gemini OpenAI-compat model name + dimensions

**Discovered:** 2026-06-26, wiring pgvector ANN for The Bayesian.
**Symptom:** `embed()` returned None against the Gemini OpenAI-compatible endpoint.
**Root cause:** `text-embedding-004` 404s on `…/v1beta/openai/embeddings` ("not found for API version v1main"). The working model is `gemini-embedding-001`. Its default output is **3072 dims**; you must pass `dimensions: 1536` to match the `vector(1536)` column from migration 007.
**Workaround:** `embedding_model = "gemini-embedding-001"` in config.py; `embeddings.py` always sends `dimensions=settings.embedding_dims`. On any mismatch/error `embed()` returns None and the Bayesian falls back to recent-by-market.
**Where it matters:** `apps/agent/stoa_agent/config.py`, `triad/embeddings.py`, `supabase/migrations/007_triad_memory.sql`.

## x402 — Arc USDC is dual-interface (native + ERC-20)

**Discovered:** 2026-06-26, finalizing the tollbooth + BYO-bot client.
**Symptom:** Ambiguity over whether a toll is a native value transfer or an ERC-20 transfer, and at what decimals.
**Root cause:** Arc exposes USDC as both a native gas token and an ERC-20 at `0x3600000000000000000000000000000000000000` (6 decimals). A native transfer's decimal basis is ambiguous.
**Workaround:** The BYO-bot pays via an **ERC-20 `transfer`** (deterministic 6 decimals); `x402.ts` verifies the ERC-20 path and restricts it to `ARC_USDC_ADDRESS`. The native-value path is kept as a secondary accept.
**Where it matters:** `apps/web/src/lib/x402.ts`, `examples/byo-bot/consume_feed.py`.
