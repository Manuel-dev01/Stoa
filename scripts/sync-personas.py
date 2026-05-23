"""
Sync persona names from wallets.json to Supabase agents.display_handle.

Usage: cd apps/agent && uv run python ../../scripts/sync-personas.py

Requires: scripts/agents/wallets.json, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

WALLETS_FILE = Path(__file__).parent / "agents" / "wallets.json"

# Load env from root .env.local if not already set
env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

PERSONA_LABELS = {
    "stoikos": "Stoikos",
    "heraklit": "Heraklit",
    "phyrr": "Phyrr",
    "artemis": "Artemis",
    "athena": "Athena",
    "hermes": "Hermes",
}


def main():
    if not WALLETS_FILE.exists():
        print("ERROR: wallets.json not found.")
        return

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
        return

    agents = json.loads(WALLETS_FILE.read_text())
    registered = [a for a in agents if a.get("agent_id")]
    print(f"Found {len(registered)} registered agents in wallets.json")

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    # Upsert all agents in batches (insert if missing, update display_handle)
    upserted = 0
    for agent in registered:
        agent_id = agent["agent_id"]
        persona_key = agent.get("persona", "stoikos")
        display_handle = PERSONA_LABELS.get(persona_key, persona_key.title())
        owner_address = agent.get("address", "")

        row = {
            "agent_id": agent_id,
            "owner_address": owner_address,
            "display_handle": display_handle,
        }

        for attempt in range(3):
            try:
                resp = httpx.post(
                    f"{supabase_url}/rest/v1/agents",
                    headers=headers,
                    json=row,
                    timeout=15.0,
                )
                if resp.status_code in (200, 201, 204):
                    upserted += 1
                    print(f"  {agent_id[:16]}... -> {display_handle}")
                else:
                    print(f"  FAILED {agent_id[:16]}... -> {resp.status_code}: {resp.text[:100]}")
                break
            except httpx.ReadTimeout:
                if attempt < 2:
                    print(f"  RETRY {agent_id[:16]}... (attempt {attempt + 2}/3)")
                else:
                    print(f"  TIMEOUT {agent_id[:16]}...")

    print(f"\nUpserted {upserted}/{len(registered)} agents")


if __name__ == "__main__":
    main()
