from __future__ import annotations

import random

import httpx

from stoa_agent.polymarket.gamma import Market

KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"

# Series prefixes that produce parlay-style synthetic markets with concatenated
# outcome lists ("yes Toronto, yes Liverpool, yes ..."). DeepSeek can't reason
# on these and Kalshi never populates volume / open_interest for them, so the
# combined product is noise. Drop them at fetch time.
_PARLAY_PREFIXES = ("KXMVE", "KXMV", "KXSPORT")


async def get_kalshi_markets(limit: int = 50) -> list[Market]:
    """Fetch active Kalshi events. Returns Market objects with condition_id = 'kalshi:{event_ticker}'.

    Uses the /events endpoint (not /markets) because the legacy /markets page
    is dominated by auto-generated parlay markets whose 'title' is a concatenated
    outcome list. /events surfaces the canonical question text the way a human
    reader (and a reasoning agent) expects to see it.
    """
    markets: list[Market] = []
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                f"{KALSHI_BASE_URL}/events",
                params={"limit": min(limit * 2, 200), "status": "open"},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        for e in data.get("events", []):
            event_ticker = e.get("event_ticker") or e.get("ticker") or ""
            series_ticker = e.get("series_ticker") or ""
            title = e.get("title") or e.get("sub_title") or ""

            if not event_ticker or not title:
                continue
            if any(series_ticker.startswith(p) for p in _PARLAY_PREFIXES):
                continue
            if any(event_ticker.startswith(p) for p in _PARLAY_PREFIXES):
                continue

            # Reject titles that look like parlay concatenations even if the prefix slips through.
            if title.count(",yes ") >= 3 or title.count(", yes ") >= 3:
                continue

            # Kalshi's event endpoint exposes neither liquidity nor expiry directly.
            # We use a small positive liquidity sentinel so the daemon's scoring
            # heuristics treat these markets as real (non-zero) without overstating.
            markets.append(Market(
                condition_id=f"kalshi:{event_ticker}",
                question=title,
                end_date=None,
                outcomes=["Yes", "No"],
                liquidity=1.0,
                active=True,
                closed=False,
            ))

    random.shuffle(markets)
    return markets[:limit]
