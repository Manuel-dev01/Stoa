"""Persistent memory for the Triad, backed by Supabase (PostgREST via httpx).

  triad_episodic     — Quantec regime-loop log.
  triad_vector_state — Bayesian prompt→outcome states (read recent-by-market;
                       true ANN search over the pgvector column is a follow-up).
  triad_error_log    — per-agent calibration error; the Calibrator's penalty input.
  feed_items         — the published synthesized output the feed serves.

All writes are best-effort: memory is additive and must never block a publish.
"""

from __future__ import annotations

from typing import Any

import httpx

from stoa_agent.config import Settings


def _headers(settings: Settings) -> dict[str, str]:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _enabled(settings: Settings) -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


async def _post(settings: Settings, table: str, row: dict[str, Any]) -> dict | None:
    if not _enabled(settings):
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.supabase_url}/rest/v1/{table}",
                headers=_headers(settings),
                json=row,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return data[0] if isinstance(data, list) and data else data
    except Exception:
        return None
    return None


async def _get(settings: Settings, table: str, params: dict[str, str]) -> list[dict]:
    if not _enabled(settings):
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/{table}",
                headers=_headers(settings),
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else []
    except Exception:
        return []
    return []


# --- Quantec episodic memory ---

async def recent_episodic(settings: Settings, market_id: str, limit: int = 3) -> list[dict]:
    """The most recent regime snapshots for this market."""
    return await _get(
        settings,
        "triad_episodic",
        {
            "market_id": f"eq.{market_id}",
            "order": "created_at.desc",
            "limit": str(limit),
            "select": "regime,rhymes_with,features,created_at",
        },
    )


async def write_episodic(
    settings: Settings,
    *,
    agent_id: str | None,
    market_id: str,
    cycle: int,
    features: dict,
    regime: str | None,
    rhymes_with: str | None,
) -> None:
    await _post(
        settings,
        "triad_episodic",
        {
            "agent_id": agent_id,
            "market_id": market_id,
            "cycle": cycle,
            "features": features,
            "regime": regime,
            "rhymes_with": rhymes_with,
        },
    )


# --- Bayesian vector memory ---

async def recent_states(settings: Settings, market_id: str, limit: int = 5) -> list[dict]:
    """Recent prompt→outcome states for this market (fallback when no embedding)."""
    return await _get(
        settings,
        "triad_vector_state",
        {
            "market_id": f"eq.{market_id}",
            "order": "updated_at.desc",
            "limit": str(limit),
            "select": "rating,outcome,weight,updated_at",
        },
    )


async def nearest_states(
    settings: Settings,
    embedding: list[float],
    market_id: str,
    limit: int = 5,
) -> list[dict]:
    """True ANN retrieval: the nearest historical states by cosine distance.

    Calls the `match_vector_states` RPC (migration 009). Returns [] on failure,
    so the caller can fall back to recent_states.
    """
    if not _enabled(settings) or not embedding:
        return []
    # PostgREST passes the embedding as text; the RPC casts it to vector.
    body = {
        "query_embedding": "[" + ",".join(str(x) for x in embedding) + "]",
        "p_market_id": market_id,
        "match_count": limit,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.supabase_url}/rest/v1/rpc/match_vector_states",
                headers=_headers(settings),
                json=body,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else []
    except Exception:
        return []
    return []


async def write_state(
    settings: Settings,
    *,
    market_id: str,
    rating: int,
    embedding: list[float] | None = None,
    outcome: str | None = None,
    weight: float = 1.0,
) -> None:
    row: dict[str, Any] = {"market_id": market_id, "rating": rating, "weight": weight}
    if embedding is not None:
        row["embedding"] = embedding
    if outcome is not None:
        row["outcome"] = outcome
    await _post(settings, "triad_vector_state", row)


# --- Calibrator error memory ---

async def agent_penalty(settings: Settings, agent: str, lookback: int = 20) -> float:
    """A [0,1] penalty for an agent from its recent signed calibration error.

    Higher = more overconfident-and-wrong historically. 0 when there's no
    history yet (a fresh agent is trusted until it earns a penalty).
    """
    rows = await _get(
        settings,
        "triad_error_log",
        {
            "agent": f"eq.{agent}",
            "order": "created_at.desc",
            "limit": str(lookback),
            "select": "signed_error",
        },
    )
    errors = [float(r["signed_error"]) for r in rows if r.get("signed_error") is not None]
    if not errors:
        return 0.0
    # Mean of positive (overconfident-wrong) error, clamped to [0, 1].
    overconfident = [e for e in errors if e > 0]
    if not overconfident:
        return 0.0
    return max(0.0, min(1.0, sum(overconfident) / len(errors)))


async def write_error(
    settings: Settings,
    *,
    agent: str,
    market_id: str,
    trace_hash: str | None,
    predicted_confidence_bps: int,
    predicted_rating: int,
    resolved_outcome: str,
    signed_error: float,
) -> None:
    await _post(
        settings,
        "triad_error_log",
        {
            "agent": agent,
            "market_id": market_id,
            "trace_hash": trace_hash,
            "predicted_confidence_bps": predicted_confidence_bps,
            "predicted_rating": predicted_rating,
            "resolved_outcome": resolved_outcome,
            "signed_error": signed_error,
        },
    )


# --- Published feed ---

async def write_feed_item(settings: Settings, row: dict[str, Any]) -> dict | None:
    return await _post(settings, "feed_items", row)
