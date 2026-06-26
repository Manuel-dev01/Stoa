"""Apply Supabase migrations via the Management API (no psql / CLI needed).

The service-role key only talks to PostgREST, which can't run DDL. This script
uses a Supabase Personal Access Token (PAT) + the Management API SQL endpoint to
run each migration file in order.

Setup:
  1. Create a PAT at https://supabase.com/dashboard/account/tokens (starts `sbp_`).
  2. export SUPABASE_ACCESS_TOKEN=sbp_...
     (SUPABASE_URL is read from apps/agent/.env.local or the environment.)

Run:
  python scripts/apply-migrations.py            # applies 005..009 in order
  python scripts/apply-migrations.py --print     # just print the bundled SQL
  python scripts/apply-migrations.py 007 008     # apply specific migrations

005/006 DROP columns/tables — destructive. The script prints each file and asks
for confirmation before running unless --yes is passed.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import httpx

REPO = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO / "supabase" / "migrations"
DEFAULT_ORDER = ["005", "006", "007", "008", "009"]


def load_env() -> tuple[str, str]:
    # Prefer real env; fall back to apps/agent/.env.local then root .env.local.
    url = os.environ.get("SUPABASE_URL", "")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    for envfile in (REPO / "apps" / "agent" / ".env.local", REPO / ".env.local"):
        if not envfile.exists():
            continue
        for line in envfile.read_text().splitlines():
            if "=" not in line or line.strip().startswith("#"):
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip()
            if k == "SUPABASE_URL" and not url:
                url = v
            if k == "SUPABASE_ACCESS_TOKEN" and not token:
                token = v
    return url, token


def project_ref(url: str) -> str:
    m = re.match(r"https?://([a-z0-9]+)\.supabase\.co", url)
    if not m:
        raise SystemExit(f"Could not derive project ref from SUPABASE_URL={url!r}")
    return m.group(1)


def files_for(prefixes: list[str]) -> list[Path]:
    out: list[Path] = []
    for p in prefixes:
        matches = sorted(MIGRATIONS.glob(f"{p}_*.sql"))
        if not matches:
            raise SystemExit(f"No migration file for prefix {p}")
        out.extend(matches)
    return out


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    order = args or DEFAULT_ORDER
    files = files_for(order)

    if "--print" in flags:
        for f in files:
            print(f"\n-- ===== {f.name} =====\n{f.read_text()}")
        return

    url, token = load_env()
    if not token:
        raise SystemExit(
            "SUPABASE_ACCESS_TOKEN not set. Create a PAT at "
            "https://supabase.com/dashboard/account/tokens and export it, "
            "or run with --print and paste into the SQL editor."
        )
    ref = project_ref(url)
    endpoint = f"https://api.supabase.com/v1/projects/{ref}/database/query"

    print(f"Project: {ref}\nApplying: {', '.join(f.name for f in files)}")
    if "--yes" not in flags:
        ans = input("005/006 drop columns/tables. Proceed? [y/N] ").strip().lower()
        if ans != "y":
            print("Aborted.")
            return

    with httpx.Client(timeout=60) as client:
        for f in files:
            sql = f.read_text()
            resp = client.post(
                endpoint,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"query": sql},
            )
            ok = resp.status_code in (200, 201)
            print(f"  {f.name:28} -> {resp.status_code} {'OK' if ok else resp.text[:200]}")
            if not ok:
                raise SystemExit(f"Stopped at {f.name}.")
    print("Done.")


if __name__ == "__main__":
    main()
