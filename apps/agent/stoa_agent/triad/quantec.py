"""The Quantec — structural-data engine.

Reasons strictly from order-book depth, funding, and macro actuals, conditioned
on the market's recent regime history (episodic memory). Emits a directional
read plus the regime it mapped the current structure to.
"""

from __future__ import annotations

import json

from stoa_agent.config import Settings
from stoa_agent.polymarket.gamma import Market
from stoa_agent.triad.llm import ModelSpec, call_llm_json, clamp_bps, clamp_rating

SYSTEM = (
    "You are The Quantec, a structural-data analyst for prediction markets. "
    "You reason ONLY from hard structural inputs: order-book depth and imbalance, "
    "perp funding rates, liquidity/volume, and released macro actuals (CPI, rates). "
    "You ignore narrative and sentiment entirely. Nulls mean the data is missing — "
    "say so and lower confidence rather than inventing it. Respond with ONLY JSON."
)


async def run_quantec(
    settings: Settings,
    market: Market,
    features: dict,
    episodic: list[dict],
    spec: ModelSpec | None = None,
) -> dict:
    episodic_summary = (
        "\n".join(
            f"- regime={e.get('regime')!r} rhymed_with={e.get('rhymes_with')!r}"
            for e in episodic
        )
        or "- (no prior regime history for this market)"
    )

    user = f"""## Market
Question: {market.question}
Outcomes: {', '.join(market.outcomes) or 'Yes/No'}

## Structural snapshot
{json.dumps(features, indent=2)}

## Episodic memory (most recent regimes you logged for this market)
{episodic_summary}

## Task
Classify the CURRENT structural regime in a few words. Name the historical loop it
rhymes with (or "none"). Give a directional read grounded strictly in the structure
above — cite specific numbers (spread, depth imbalance, funding). If the structural
signal is weak or data is missing, keep confidence low.

Respond with ONLY this JSON:
{{
  "regime": "short label, e.g. 'thin-book risk-off'",
  "rhymes_with": "a prior regime or 'none'",
  "rating": -3 to 3 (negative = NO/sell, positive = YES/buy),
  "confidence_bps": 0 to 10000,
  "note": "1-3 sentences citing the structural numbers that drove the read"
}}"""

    parsed = call_llm_json(settings, SYSTEM, user, spec=spec)
    return {
        "regime": str(parsed.get("regime", "")) or None,
        "rhymes_with": str(parsed.get("rhymes_with", "")) or None,
        "rating": clamp_rating(parsed.get("rating", 0)),
        "confidence_bps": clamp_bps(parsed.get("confidence_bps", 0)),
        "note": str(parsed.get("note", "")),
    }
