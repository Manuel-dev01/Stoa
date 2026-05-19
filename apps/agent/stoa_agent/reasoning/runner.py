from __future__ import annotations

import os

from stoa_agent.errors import TradingAgentsInferenceError
from stoa_agent.polymarket.gamma import Market


def map_signal_to_rating(signal: str, confidence: float) -> int:
    """Map BUY/SELL/HOLD + confidence to a -3..+3 rating scale.

    High confidence (>0.7) pushes toward the extremes.
    Low confidence (<0.4) stays near neutral.
    """
    signal = signal.strip().upper()
    if signal == "BUY":
        if confidence >= 0.7:
            return 3
        if confidence >= 0.4:
            return 2
        return 1
    if signal == "SELL":
        if confidence >= 0.7:
            return -3
        if confidence >= 0.4:
            return -2
        return -1
    return 0  # HOLD


def confidence_to_bps(confidence: float) -> int:
    """Convert 0.0-1.0 confidence to 0-10000 basis points."""
    return max(0, min(10000, int(confidence * 10000)))


def run_inference(market: Market) -> dict:
    """Run TradingAgents inference against a Polymarket market.

    Returns a dict with keys: bull, bear, synthesis, rating, confidence_bps.
    """
    from stoa_agent.config import load_settings

    settings = load_settings()
    os.environ["DEEPSEEK_API_KEY"] = settings.deepseek_api_key

    try:
        from tradingagents import TradingAgentsConfig, TradingAgentsGraph
    except ImportError as e:
        raise TradingAgentsInferenceError(
            f"TradingAgents import failed: {e}. Is tradingagents installed?"
        ) from e

    config = TradingAgentsConfig(
        llm_provider="litellm",
        deep_think_llm="deepseek/deepseek-chat",
        quick_think_llm="deepseek/deepseek-chat",
        max_debate_rounds=1,
        max_risk_discuss_rounds=1,
        max_recur_limit=100,
    )

    # TradingAgents propagate takes (company_name, trade_date)
    # For prediction markets, we use the question as company_name
    company_name = market.question[:100]
    # TradingAgents requires trade_date <= today (it fetches market data up to that date)
    from datetime import date
    trade_date = date.today().isoformat()

    try:
        graph = TradingAgentsGraph(config=config)
        state, recommendation = graph.propagate(company_name, trade_date)
    except Exception as e:
        raise TradingAgentsInferenceError(f"TradingAgents inference failed: {e}") from e

    # Extract reasoning from AgentState (Pydantic model, not dict)
    debate = state.investment_debate_state
    bull = debate.bull_history if debate else ""
    bear = debate.bear_history if debate else ""
    synthesis = state.investment_plan or state.trader_investment_plan

    # Use structured TradeRecommendation for signal + confidence
    if recommendation is not None:
        signal = recommendation.signal  # BUY / SELL / HOLD
        conf = recommendation.confidence  # 0.0-1.0
        rationale = recommendation.rationale
    else:
        # Fallback: parse final_trade_decision text
        final_decision = state.final_trade_decision or ""
        signal = "BUY" if "buy" in final_decision.lower() else (
            "SELL" if "sell" in final_decision.lower() else "HOLD"
        )
        conf = 0.5
        rationale = final_decision

    rating = map_signal_to_rating(signal, conf)
    confidence_bps = confidence_to_bps(conf)

    return {
        "bull": bull,
        "bear": bear,
        "synthesis": synthesis or rationale,
        "rating": rating,
        "confidence_bps": confidence_bps,
    }
