"""The Calibrator — metacognitive Kelly engine.

Does NOT re-analyze the market. It weighs The Quantec and The Bayesian against
their own historical error logs, shrinking a prior-wrong agent's contribution,
reconciles the two into a single rating + confidence, and applies a FRACTIONAL
Kelly Criterion to size the stake. The numeric outputs are computed
deterministically (auditable for the demo); the LLM only writes the narrative.
"""

from __future__ import annotations

import json

from stoa_agent.config import Settings
from stoa_agent.triad.llm import ModelSpec, call_llm_json

# Half-Kelly, and never stake more than 25% of bankroll on one market.
KELLY_FRACTION = 0.5
KELLY_CAP = 0.25

SYSTEM = (
    "You are The Calibrator, the metacognitive engine of the Triad. You are given "
    "two agents' reads, the penalty each earned from its historical error log, and "
    "the final reconciled decision already computed mathematically. Write the "
    "bull/bear/synthesis narrative that explains how the penalty-weighted "
    "reconciliation reached that decision. Respond with ONLY JSON."
)


def _agent_weight(confidence_bps: int, penalty: float) -> float:
    """Penalty-shrunk evidence weight: confidence × (1 − penalty)."""
    return (confidence_bps / 10000.0) * max(0.0, 1.0 - penalty)


def reconcile(
    quantec: dict,
    bayesian: dict,
    quantec_penalty: float,
    bayesian_penalty: float,
    market_price: float | None,
) -> dict:
    """Penalty-weighted reconciliation + fractional Kelly. Pure function."""
    wq = _agent_weight(quantec["confidence_bps"], quantec_penalty)
    wb = _agent_weight(bayesian["confidence_bps"], bayesian_penalty)
    total = wq + wb

    if total == 0:
        rating, confidence_bps = 0, 0
    else:
        blended_rating = (quantec["rating"] * wq + bayesian["rating"] * wb) / total
        rating = max(-3, min(3, round(blended_rating)))
        # Confidence is the weighted confidence, shrunk by disagreement between
        # the two agents (full agreement keeps it, opposite signs halve it).
        agree = 1.0 if quantec["rating"] * bayesian["rating"] >= 0 else 0.5
        weighted_conf = (
            quantec["confidence_bps"] * wq + bayesian["confidence_bps"] * wb
        ) / total
        confidence_bps = int(max(0, min(10000, weighted_conf * agree)))

    # Estimated YES probability from the reconciled confidence + direction.
    q = 0.5 + (rating / 3.0) * (confidence_bps / 10000.0) * 0.5
    q = max(0.01, min(0.99, q))
    # Price to bet against: market midpoint, else assume efficiently priced (q).
    p = market_price if (market_price and 0 < market_price < 1) else q

    # Fractional Kelly for a binary YES/NO bet on the direction with edge.
    if rating > 0 and (1 - p) > 0:
        raw_kelly = (q - p) / (1 - p)
    elif rating < 0 and p > 0:
        raw_kelly = ((1 - q) - (1 - p)) / p  # NO-side edge
    else:
        raw_kelly = 0.0
    kelly_fraction = max(0.0, min(KELLY_CAP, KELLY_FRACTION * raw_kelly))

    return {
        "rating": rating,
        "confidence_bps": confidence_bps,
        "kelly_fraction": round(kelly_fraction, 4),
        "quantec_weight": round(wq, 4),
        "bayesian_weight": round(wb, 4),
        "estimated_prob_yes": round(q, 4),
        "market_price": round(p, 4),
    }


async def run_calibrator(
    settings: Settings,
    market_question: str,
    quantec: dict,
    bayesian: dict,
    quantec_penalty: float,
    bayesian_penalty: float,
    market_price: float | None,
    spec: ModelSpec | None = None,
) -> dict:
    decision = reconcile(quantec, bayesian, quantec_penalty, bayesian_penalty, market_price)

    user = f"""## Market
{market_question}

## The Quantec (structural) — penalty {quantec_penalty:.2f}
{json.dumps(quantec, indent=2)}

## The Bayesian (time-series) — penalty {bayesian_penalty:.2f}
{json.dumps(bayesian, indent=2)}

## Reconciled decision (already computed — do not change the numbers)
{json.dumps(decision, indent=2)}

## Task
Explain the reconciliation. Note which agent you weighted down and why (its penalty).
Write a bull case, a bear case, and a synthesis that justifies the final rating,
confidence, and Kelly fraction above.

Respond with ONLY this JSON:
{{
  "bull": "2-3 paragraphs: the strongest case FOR a YES resolution given the two reads.",
  "bear": "2-3 paragraphs: the strongest case AGAINST, including the penalized agent's risk.",
  "synthesis": "1-2 paragraphs reconciling both, naming the penalty you applied and how the fractional Kelly sized the stake."
}}"""

    parsed = call_llm_json(settings, SYSTEM, user, spec=spec, max_tokens=2200)

    return {
        **decision,
        "quantec_penalty": round(quantec_penalty, 4),
        "bayesian_penalty": round(bayesian_penalty, 4),
        "bull": str(parsed.get("bull", "")),
        "bear": str(parsed.get("bear", "")),
        "synthesis": str(parsed.get("synthesis", "")),
    }
