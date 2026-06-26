"""The Bayesian — time-series & sentiment engine.

Reasons from price action, momentum, and sentiment, updating its prior with the
empirical track record of similar setups retrieved from rolling memory.
"""

from __future__ import annotations

from stoa_agent.config import Settings
from stoa_agent.polymarket.gamma import Market
from stoa_agent.triad.llm import ModelSpec, call_llm_json, clamp_bps, clamp_rating

SYSTEM = (
    "You are The Bayesian, a technical and sentiment time-series analyst for "
    "prediction markets. You reason from price action, momentum, sentiment flow, "
    "and the empirical track record of similar setups. Update your prior with the "
    "historical states provided: lean toward setups that resolved in your favor, "
    "discount patterns that burned you. Respond with ONLY JSON."
)


async def run_bayesian(
    settings: Settings,
    market: Market,
    historical_states: list[dict],
    spec: ModelSpec | None = None,
) -> dict:
    if historical_states:
        states_summary = "\n".join(
            f"- rating={s.get('rating')} outcome={s.get('outcome') or 'unresolved'} "
            f"weight={s.get('weight')}"
            for s in historical_states
        )
    else:
        states_summary = "- (no historical states yet — reason from a flat prior)"

    user = f"""## Market
Question: {market.question}
Outcomes: {', '.join(market.outcomes) or 'Yes/No'}
Liquidity: ${market.liquidity:,.0f}  Volume: ${market.volume:,.0f}

## Historical prompt→outcome states (your rolling memory for this market)
{states_summary}

## Task
Estimate the probability this resolves YES, conditioning on the historical states.
State which states you leaned on. Output a calibrated directional read.

Respond with ONLY this JSON:
{{
  "probability_yes": 0.0 to 1.0,
  "rating": -3 to 3 (negative = NO/sell, positive = YES/buy),
  "confidence_bps": 0 to 10000,
  "note": "1-3 sentences naming the historical evidence you used"
}}"""

    parsed = call_llm_json(settings, SYSTEM, user, spec=spec)
    prob = parsed.get("probability_yes")
    try:
        prob = max(0.0, min(1.0, float(prob)))
    except (TypeError, ValueError):
        prob = None
    return {
        "probability_yes": prob,
        "rating": clamp_rating(parsed.get("rating", 0)),
        "confidence_bps": clamp_bps(parsed.get("confidence_bps", 0)),
        "note": str(parsed.get("note", "")),
    }
