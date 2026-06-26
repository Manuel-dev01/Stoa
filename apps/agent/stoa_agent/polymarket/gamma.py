from __future__ import annotations

import json
import random
import re

import httpx
from pydantic import BaseModel, field_validator

from stoa_agent.errors import GammaApiError, MarketNotFoundError

GAMMA_BASE_URL = "https://gamma-api.polymarket.com"

# Scope lock: Stoa's Triad only reasons over macro and crypto markets. Gamma's
# category field is unreliable, so we match question text + tags against this
# curated keyword set. Lowercase, matched as substrings on word-ish boundaries.
MACRO_CRYPTO_KEYWORDS: frozenset[str] = frozenset(
    {
        # macro / rates / inflation
        "fed", "fomc", "interest rate", "rate cut", "rate hike", "rate decision",
        "cpi", "inflation", "pce", "jobs report", "nonfarm", "unemployment",
        "recession", "gdp", "treasury", "yield", "powell", "jerome powell",
        "basis points", "bps", "soft landing", "quantitative",
        # crypto majors
        "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "crypto",
        "stablecoin", "usdc", "usdt", "etf", "spot etf", "halving",
        "perp", "perpetual", "funding rate", "altcoin", "memecoin",
        "binance", "coinbase", "microstrategy",
    }
)

# Optional override: explicit condition_ids that should always be in-scope
# regardless of the keyword heuristic (e.g. a flagship market with odd phrasing).
# Populate from STOA_MARKET_ALLOWLIST (comma-separated) at call time.
CONDITION_ID_ALLOWLIST: frozenset[str] = frozenset()


class Market(BaseModel):
    condition_id: str
    question: str
    end_date: str | None = None
    outcomes: list[str] = []
    clob_token_ids: list[str] = []
    liquidity: float = 0.0
    volume: float = 0.0
    tags: list[str] = []
    active: bool = True
    closed: bool = False

    @field_validator("outcomes", "clob_token_ids", mode="before")
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

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v: object) -> list[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else [v]
            except (json.JSONDecodeError, ValueError):
                return [v]
        if isinstance(v, list):
            return [str(t) for t in v]
        return []


# Match keywords on word boundaries so short tokens like "eth"/"btc"/"fed" don't
# substring-match inside unrelated words ("Netherlands", "Hegseth", "federal").
_KEYWORD_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(k) for k in sorted(MACRO_CRYPTO_KEYWORDS, key=len, reverse=True)) + r")\b"
)


def is_macro_crypto(market: Market, allowlist: frozenset[str] = CONDITION_ID_ALLOWLIST) -> bool:
    """True if the market is a macro or crypto market by keyword/tag heuristic."""
    if market.condition_id.lower() in allowlist:
        return True
    haystack = " ".join([market.question, *market.tags]).lower()
    return bool(_KEYWORD_RE.search(haystack))


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
        clob_token_ids=m.get("clobTokenIds", []),
        liquidity=float(m.get("liquidity", 0) or 0),
        volume=float(m.get("volume", 0) or 0),
        tags=m.get("tags", []),
        active=m.get("active", True),
        closed=m.get("closed", False),
    )


async def get_top_macro_crypto_markets(
    top_n: int = 10,
    min_liquidity: float = 1000,
    allowlist: frozenset[str] = CONDITION_ID_ALLOWLIST,
) -> list[Market]:
    """The Triad's scope-locked market universe.

    Fetches active markets, keeps only macro/crypto (keyword/tag heuristic +
    allowlist), and returns the top_n by volume (falling back to liquidity).
    Deterministic — no shuffle — so the feed covers the same flagship markets
    each cycle and the episodic memory accumulates per-market history.
    """
    all_raw: list[dict] = []
    async with httpx.AsyncClient(timeout=30) as client:
        for offset in range(0, 500, 100):
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

    scoped: list[Market] = []
    for m in all_raw:
        if not m.get("conditionId") and not m.get("condition_id"):
            continue
        market = _parse_market(m)
        if market.closed or market.liquidity < min_liquidity:
            continue
        if not is_macro_crypto(market, allowlist):
            continue
        scoped.append(market)

    # Top by volume, then liquidity as a tiebreaker.
    scoped.sort(key=lambda mk: (mk.volume, mk.liquidity), reverse=True)
    return scoped[:top_n]


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
