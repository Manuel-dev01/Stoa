"""Triad orchestrator — runs Quantec → Bayesian → Calibrator for one market.

Returns a single cross-calibrated synthesis: reasoning (bull/bear/synthesis),
decision (rating/confidence/kelly), and the per-agent breakdown. The daemon
takes this, anchors it on Irys + Arc, and writes the feed_items row.
"""

from __future__ import annotations

from stoa_agent.config import Settings
from stoa_agent.polymarket.gamma import Market
from stoa_agent.triad import bayesian as bayesian_mod
from stoa_agent.triad import calibrator as calibrator_mod
from stoa_agent.triad import memory, quantec as quantec_mod
from stoa_agent.triad.embeddings import embed
from stoa_agent.triad.llm import model_for
from stoa_agent.triad.structural import fetch_structural_features


async def run_triad_for_market(
    settings: Settings,
    market: Market,
    cycle: int,
    agent_id: str | None = None,
) -> dict:
    # Route each agent to its provider (Quantec→Groq, Bayesian→Gemini,
    # Calibrator→DeepSeek), with a DeepSeek fallback inside call_llm_json.
    quantec_spec = model_for(settings, "quantec")
    bayesian_spec = model_for(settings, "bayesian")
    calibrator_spec = model_for(settings, "calibrator")
    print(
        f"    triad models: quantec={quantec_spec.model} "
        f"bayesian={bayesian_spec.model} calibrator={calibrator_spec.model}",
        flush=True,
    )

    # 1. The Quantec: structural data + episodic memory.
    features = await fetch_structural_features(settings, market)
    episodic = await memory.recent_episodic(settings, market.condition_id)
    quantec_out = await quantec_mod.run_quantec(
        settings, market, features, episodic, spec=quantec_spec
    )
    await memory.write_episodic(
        settings,
        agent_id=agent_id,
        market_id=market.condition_id,
        cycle=cycle,
        features=features,
        regime=quantec_out["regime"],
        rhymes_with=quantec_out["rhymes_with"],
    )

    # 2. The Bayesian: time-series conditioned on rolling memory. Retrieve the
    # nearest historical setups by embedding (true ANN); fall back to
    # recent-by-market when no embedding is available.
    embedding = await embed(settings, market.question)
    historical = (
        await memory.nearest_states(settings, embedding, market.condition_id)
        if embedding
        else await memory.recent_states(settings, market.condition_id)
    )
    bayesian_out = await bayesian_mod.run_bayesian(
        settings, market, historical, spec=bayesian_spec
    )
    await memory.write_state(
        settings,
        market_id=market.condition_id,
        rating=bayesian_out["rating"],
        embedding=embedding,
    )

    # 3. The Calibrator: penalize prior-wrong agents, reconcile, size with Kelly.
    quantec_penalty = await memory.agent_penalty(settings, "quantec")
    bayesian_penalty = await memory.agent_penalty(settings, "bayesian")
    order_book = features.get("order_book") or {}
    market_price = order_book.get("midpoint")
    calib = await calibrator_mod.run_calibrator(
        settings,
        market.question,
        quantec_out,
        bayesian_out,
        quantec_penalty,
        bayesian_penalty,
        market_price,
        spec=calibrator_spec,
    )

    agent_breakdown = {
        "quantec": {
            "rating": quantec_out["rating"],
            "confidence_bps": quantec_out["confidence_bps"],
            "penalty": round(quantec_penalty, 4),
            "note": quantec_out["note"],
        },
        "bayesian": {
            "rating": bayesian_out["rating"],
            "confidence_bps": bayesian_out["confidence_bps"],
            "penalty": round(bayesian_penalty, 4),
            "note": bayesian_out["note"],
        },
        "calibrator": {
            "rating": calib["rating"],
            "confidence_bps": calib["confidence_bps"],
            "penalty": 0.0,
            "note": (
                f"q_w={calib['quantec_weight']} b_w={calib['bayesian_weight']} "
                f"kelly={calib['kelly_fraction']} p_yes={calib['estimated_prob_yes']}"
            ),
        },
    }

    return {
        "reasoning": {
            "bull": calib["bull"],
            "bear": calib["bear"],
            "synthesis": calib["synthesis"],
        },
        "decision": {
            "rating": calib["rating"],
            "confidence_bps": calib["confidence_bps"],
            "kelly_fraction": calib["kelly_fraction"],
        },
        "agent_breakdown": agent_breakdown,
        "features": features,
    }
