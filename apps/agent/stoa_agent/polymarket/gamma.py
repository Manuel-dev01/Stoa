from __future__ import annotations

import json
import random

import httpx
from pydantic import BaseModel, field_validator

from stoa_agent.errors import GammaApiError, MarketNotFoundError

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
    """Fetch active, unresolved markets with at least min_liquidity USDC volume.

    Paginates through 3 pages (offset 0, 100, 200) to get beyond the top 100,
    then shuffles before selecting to avoid deterministic repetition.
    """
    all_raw: list[dict] = []
    async with httpx.AsyncClient(timeout=30) as client:
        for offset in range(0, 300, 100):
            try:
                resp = await client.get(
                    f"{GAMMA_BASE_URL}/markets",
                    params={
                        "active": "true",
                        "closed": "false",
                        "limit": 100,
                        "offset": offset,
                    },
                )
                if resp.status_code != 200:
                    break
                results = resp.json()
                if not results:
                    break
                all_raw.extend(results)
            except Exception:
                break

    if not all_raw:
        raise GammaApiError("Gamma API returned no markets from any page")

    markets: list[Market] = []
    for m in all_raw:
        if not m.get("conditionId") and not m.get("condition_id"):
            continue
        market = _parse_market(m)
        if market.liquidity >= min_liquidity and not market.closed:
            markets.append(market)

    random.shuffle(markets)
    return markets[:limit]


def _parse_market(m: dict) -> Market:
    return Market(
        condition_id=m.get("conditionId") or m.get("condition_id", ""),
        question=m.get("question", ""),
        end_date=m.get("endDate") or m.get("end_date"),
        outcomes=m.get("outcomes", []),
        liquidity=float(m.get("liquidity", 0)),
        active=m.get("active", True),
        closed=m.get("closed", False),
    )


async def get_market(condition_id: str) -> Market:
    """Fetch a single market by condition_id.

    Gamma API's /markets/{id} endpoint expects a numeric id, not condition_id,
    and the list endpoint silently ignores the condition_id query param.
    We paginate through active markets and filter client-side.
    """
    target = condition_id.lower()
    async with httpx.AsyncClient(timeout=30) as client:
        for offset in range(0, 500, 100):
            resp = await client.get(
                f"{GAMMA_BASE_URL}/markets",
                params={"active": "true", "closed": "false", "limit": 100, "offset": offset},
            )
            if resp.status_code != 200:
                raise GammaApiError(f"Gamma API returned {resp.status_code}: {resp.text}")

            results = resp.json()
            if not results:
                break

            for m in results:
                cid = (m.get("conditionId") or m.get("condition_id", "")).lower()
                if cid == target:
                    return _parse_market(m)

    raise MarketNotFoundError(f"Market not found for condition_id={condition_id}")
