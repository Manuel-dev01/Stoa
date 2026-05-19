from __future__ import annotations

import json

import httpx
from pydantic import BaseModel, field_validator

from stoa_agent.errors import GammaApiError

GAMMA_BASE_URL = "https://gamma-api.polymarket.com"


class Market(BaseModel):
    condition_id: str
    question: str
    end_date: str | None = None
    outcomes: list[str] = []
    liquidity: float = 0.0
    active: bool = True
    closed: bool = False

    @field_validator("outcomes", mode="before")
    @classmethod
    def parse_outcomes(cls, v: object) -> list[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return []
        if isinstance(v, list):
            return v
        return []


async def get_active_markets(min_liquidity: float = 1000, limit: int = 5) -> list[Market]:
    """Fetch active, unresolved markets with at least min_liquidity USDC volume."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GAMMA_BASE_URL}/markets",
            params={
                "active": "true",
                "closed": "false",
                "limit": limit * 2,
            },
        )
        if resp.status_code != 200:
            raise GammaApiError(f"Gamma API returned {resp.status_code}: {resp.text}")

        raw_markets = resp.json()

    markets: list[Market] = []
    for m in raw_markets:
        if not m.get("conditionId") and not m.get("condition_id"):
            continue
        market = Market(
            condition_id=m.get("conditionId") or m.get("condition_id", ""),
            question=m.get("question", ""),
            end_date=m.get("endDate") or m.get("end_date"),
            outcomes=m.get("outcomes", []),
            liquidity=float(m.get("liquidity", 0)),
            active=m.get("active", True),
            closed=m.get("closed", False),
        )
        if market.liquidity >= min_liquidity and not market.closed:
            markets.append(market)

    return markets[:limit]


async def get_market(condition_id: str) -> Market:
    """Fetch a single market by condition_id.

    Gamma API's /markets/{id} endpoint expects a numeric id, not condition_id.
    We search via the list endpoint with a condition_id filter instead.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GAMMA_BASE_URL}/markets",
            params={"condition_id": condition_id, "limit": 1},
        )
        if resp.status_code != 200:
            raise GammaApiError(f"Gamma API returned {resp.status_code}: {resp.text}")

        results = resp.json()
        if not results:
            raise GammaApiError(f"Market not found for condition_id={condition_id}")

        m = results[0]
        return Market(
            condition_id=m.get("conditionId") or m.get("condition_id", ""),
            question=m.get("question", ""),
            end_date=m.get("endDate") or m.get("end_date"),
            outcomes=m.get("outcomes", []),
            liquidity=float(m.get("liquidity", 0)),
            active=m.get("active", True),
            closed=m.get("closed", False),
        )
