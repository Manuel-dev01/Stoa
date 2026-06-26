"""Embeddings for The Bayesian's pgvector memory.

Embeds a market's setup text so the Bayesian can retrieve the nearest historical
prompt→outcome states via ANN. Primary provider is Gemini's OpenAI-compatible
embeddings endpoint (the key we already route the Bayesian through); falls back
to OpenAI if configured. Returns None on any failure or dimension mismatch — the
orchestrator then falls back to recent-by-market retrieval, so embeddings are a
pure upgrade, never a hard dependency.
"""

from __future__ import annotations

import httpx

from stoa_agent.config import Settings

OPENAI_EMBEDDINGS = "https://api.openai.com/v1/embeddings"


async def _post_embeddings(url: str, api_key: str, payload: dict) -> list[float] | None:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            if resp.status_code != 200:
                return None
            data = resp.json().get("data") or []
            if not data:
                return None
            vec = data[0].get("embedding")
            return vec if isinstance(vec, list) else None
    except Exception:
        return None


async def embed(settings: Settings, text: str) -> list[float] | None:
    """Embed `text` to a `settings.embedding_dims`-length vector, or None."""
    text = (text or "").strip()
    if not text:
        return None
    dims = settings.embedding_dims

    # Primary: Gemini via the OpenAI-compatible endpoint (provider 3).
    if settings.provider_3_base_url and settings.provider_3_api_key:
        base = settings.provider_3_base_url.rstrip("/")
        vec = await _post_embeddings(
            f"{base}/embeddings",
            settings.provider_3_api_key,
            {"model": settings.embedding_model, "input": text, "dimensions": dims},
        )
        if vec and len(vec) == dims:
            return vec

    # Fallback: OpenAI text-embedding-3-small (1536) if a key is configured.
    if settings.openai_api_key and dims == 1536:
        vec = await _post_embeddings(
            OPENAI_EMBEDDINGS,
            settings.openai_api_key,
            {"model": "text-embedding-3-small", "input": text, "dimensions": dims},
        )
        if vec and len(vec) == dims:
            return vec

    return None
