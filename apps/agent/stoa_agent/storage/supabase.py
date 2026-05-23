from __future__ import annotations

import httpx

from stoa_agent.config import Settings


def _headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


def save_agent_wallet(
    settings: Settings,
    agent_id: str,
    wallet_id: str,
    wallet_address: str,
) -> None:
    """Upsert an agent_id -> Circle wallet mapping in Supabase."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase not configured")

    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{settings.supabase_url}/rest/v1/agent_wallets",
            json={
                "agent_id": agent_id,
                "wallet_id": wallet_id,
                "wallet_address": wallet_address,
            },
            headers=_headers(settings.supabase_service_role_key),
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase upsert failed ({resp.status_code}): {resp.text}")


def get_agent_wallet(
    settings: Settings,
    agent_id: str,
) -> dict[str, str] | None:
    """Look up a Circle wallet for an agent. Returns {wallet_id, wallet_address} or None."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{settings.supabase_url}/rest/v1/agent_wallets",
            params={
                "agent_id": f"eq.{agent_id}",
                "select": "wallet_id,wallet_address",
            },
            headers=_headers(settings.supabase_service_role_key),
        )
        if resp.status_code != 200:
            return None

        rows = resp.json()
        if not rows:
            return None
        return {"wallet_id": rows[0]["wallet_id"], "wallet_address": rows[0]["wallet_address"]}
