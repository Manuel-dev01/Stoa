from __future__ import annotations

import random
from datetime import datetime, timezone

import httpx

from stoa_agent.polymarket.gamma import Market

KALSHI_BASE_URL = "https://trading-api.kalshi.com/trade-api/v2"


async def get_kalshi_markets(limit: int = 50) -> list[Market]:
    """Fetch active Kalshi markets. Returns Market objects with condition_id = 'kalshi:{ticker}'.

    Kalshi API provides read-only market data without authentication.
    """
    markets: list[Market] = []
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                f"{KALSHI_BASE_URL}/markets",
                params={"limit": min(limit, 100), "status": "open"},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        for m in data.get("markets", []):
            question = m.get("subtitle") or m.get("title", "")
            if not question:
                continue

            # Parse close_time to ISO format
            end_date = None
            close_time = m.get("close_time") or m.get("expiration_time")
            if close_time:
                try:
                    if isinstance(close_time, str):
                        end_date = close_time
                    else:
                        end_date = datetime.fromtimestamp(close_time, tz=timezone.utc).isoformat()
                except (ValueError, TypeError, OSError):
                    pass

            # Kalshi markets are binary (Yes/No)
            # open_interest is in cents, convert to approximate dollar liquidity
            open_interest = float(m.get("open_interest", 0) or 0)
            liquidity = open_interest / 100.0

            ticker = m.get("ticker", "")
            if not ticker:
                continue

            markets.append(Market(
                condition_id=f"kalshi:{ticker}",
                question=question,
                end_date=end_date,
                outcomes=["Yes", "No"],
                liquidity=liquidity,
                active=m.get("status") == "open",
                closed=False,
            ))

    random.shuffle(markets)
    return markets[:limit]
