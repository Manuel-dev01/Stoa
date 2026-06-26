"""Structural-data collection for The Quantec.

Pulls the hard inputs the Quantec reasons over: Polymarket CLOB order-book
depth/imbalance for the market, plus best-effort perp funding rates for
crypto markets. CPI/macro actuals are stubbed at hackathon scope — see
docs/footguns.md — and surface as nulls the Quantec is told to treat as missing.
"""

from __future__ import annotations

import time

import httpx

from stoa_agent.config import Settings
from stoa_agent.polymarket.gamma import Market

CLOB_BASE_URL = "https://clob.polymarket.com"
BINANCE_FUTURES = "https://fapi.binance.com/fapi/v1/premiumIndex"
FRED_OBSERVATIONS = "https://api.stlouisfed.org/fred/series/observations"

# Macro data changes monthly; cache the snapshot for the whole cycle so 10
# markets don't fan out 20 FRED calls. (value, monotonic_ts).
_MACRO_TTL_SECONDS = 1800
_macro_cache: tuple[dict, float] | None = None


async def _fetch_order_book(token_id: str) -> dict | None:
    """Best bid/ask, spread, midpoint, and depth/imbalance for a CLOB token."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{CLOB_BASE_URL}/book", params={"token_id": token_id})
            if resp.status_code != 200:
                return None
            book = resp.json()
    except Exception:
        return None

    bids = book.get("bids") or []
    asks = book.get("asks") or []
    if not bids and not asks:
        return None

    def _price(level: dict) -> float:
        return float(level.get("price", 0) or 0)

    def _size(level: dict) -> float:
        return float(level.get("size", 0) or 0)

    # CLOB returns bids ascending and asks descending; take the extremes.
    best_bid = max((_price(b) for b in bids), default=0.0)
    best_ask = min((_price(a) for a in asks if _price(a) > 0), default=0.0)
    bid_depth = sum(_size(b) for b in bids)
    ask_depth = sum(_size(a) for a in asks)
    total_depth = bid_depth + ask_depth
    imbalance = (bid_depth - ask_depth) / total_depth if total_depth else 0.0
    spread = (best_ask - best_bid) if (best_bid and best_ask) else None
    midpoint = ((best_bid + best_ask) / 2) if (best_bid and best_ask) else None

    return {
        "best_bid": round(best_bid, 4),
        "best_ask": round(best_ask, 4),
        "spread": round(spread, 4) if spread is not None else None,
        "midpoint": round(midpoint, 4) if midpoint is not None else None,
        "bid_depth": round(bid_depth, 2),
        "ask_depth": round(ask_depth, 2),
        "depth_imbalance": round(imbalance, 4),
    }


async def _fetch_funding_rate(question: str) -> dict | None:
    """Perp funding for BTC/ETH when the market clearly references them."""
    q = question.lower()
    if "btc" in q or "bitcoin" in q:
        symbol = "BTCUSDT"
    elif "eth" in q or "ethereum" in q:
        symbol = "ETHUSDT"
    else:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(BINANCE_FUTURES, params={"symbol": symbol})
            if resp.status_code != 200:
                return None
            data = resp.json()
        return {
            "symbol": symbol,
            "mark_price": float(data.get("markPrice", 0) or 0),
            "last_funding_rate": float(data.get("lastFundingRate", 0) or 0),
        }
    except Exception:
        return None


async def _fred_latest(client: httpx.AsyncClient, api_key: str, series_id: str, count: int) -> list[float]:
    """The latest `count` numeric observations for a FRED series, newest first."""
    resp = await client.get(
        FRED_OBSERVATIONS,
        params={
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": count,
        },
    )
    if resp.status_code != 200:
        return []
    obs = resp.json().get("observations", [])
    values: list[float] = []
    for o in obs:
        try:
            values.append(float(o["value"]))
        except (KeyError, TypeError, ValueError):
            continue  # FRED uses "." for missing
    return values


async def _fetch_macro(settings: Settings) -> dict:
    """Latest CPI YoY and Fed funds rate from FRED, cached per cycle."""
    global _macro_cache
    if not settings.fred_api_key:
        return {"cpi_yoy_pct": None, "fed_funds_rate_pct": None}
    if _macro_cache is not None:
        value, ts = _macro_cache
        if (time.monotonic() - ts) < _MACRO_TTL_SECONDS:
            return value

    cpi_yoy: float | None = None
    fed_funds: float | None = None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # CPIAUCSL is an index level; YoY = (latest - 12-months-ago) / 12-months-ago.
            # Fetch a buffer of 15 so an occasional missing/"." observation (which
            # _fred_latest filters out) still leaves the 13 points YoY needs.
            cpi = await _fred_latest(client, settings.fred_api_key, "CPIAUCSL", 15)
            if len(cpi) >= 13 and cpi[12]:
                cpi_yoy = round((cpi[0] - cpi[12]) / cpi[12] * 100, 2)
            funds = await _fred_latest(client, settings.fred_api_key, "FEDFUNDS", 1)
            if funds:
                fed_funds = round(funds[0], 2)
    except Exception:
        pass

    snapshot = {"cpi_yoy_pct": cpi_yoy, "fed_funds_rate_pct": fed_funds}
    _macro_cache = (snapshot, time.monotonic())
    return snapshot


async def fetch_structural_features(settings: Settings, market: Market) -> dict:
    """Collect the Quantec's structural snapshot for a market."""
    token_id = market.clob_token_ids[0] if market.clob_token_ids else None
    order_book = await _fetch_order_book(token_id) if token_id else None
    funding = await _fetch_funding_rate(market.question)
    macro = await _fetch_macro(settings)

    return {
        "liquidity_usd": market.liquidity,
        "volume_usd": market.volume,
        "outcomes": market.outcomes,
        "order_book": order_book,
        "funding": funding,
        # Real macro actuals from FRED (null when FRED_API_KEY is unset; the
        # Quantec treats nulls as missing data).
        "cpi_actual": macro["cpi_yoy_pct"],
        "rate_decision": macro["fed_funds_rate_pct"],
    }
