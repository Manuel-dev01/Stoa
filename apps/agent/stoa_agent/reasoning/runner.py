from __future__ import annotations

import json
import os
import re

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


def run_inference_direct(market: Market, persona: str | None = None) -> dict:
    """Direct DeepSeek inference — primary method for prediction markets.

    Uses probabilistic reasoning tailored to prediction market questions.
    If persona is provided, it replaces the default role preamble.
    """
    from stoa_agent.config import load_settings
    import litellm

    settings = load_settings()
    os.environ["DEEPSEEK_API_KEY"] = settings.deepseek_api_key
    if not persona and settings.agent_persona:
        persona = settings.agent_persona

    outcomes_str = ", ".join(market.outcomes) if market.outcomes else "Yes/No"
    end_date_str = f"\nResolution date: {market.end_date}" if market.end_date else ""

    role_preamble = persona or "You are a prediction market analyst. Your job is to estimate the probability that a binary event will resolve YES, then recommend whether to BUY or SELL at the current implied price."

    prompt = f"""{role_preamble}

## Market
Question: {market.question}
Outcomes: {outcomes_str}
Liquidity: ${market.liquidity:,.0f}{end_date_str}

## Instructions
Think in terms of calibrated probabilities. Your goal is accuracy, not persuasion.

For the bull case, identify concrete reasons the outcome is more likely than the market implies. Cite specific facts, data points, precedents, or structural advantages. Avoid vague optimism.

For the bear case, identify concrete reasons the outcome is less likely than the market implies. Cite specific risks, counter-evidence, base rates for similar events, or structural obstacles. Avoid vague pessimism.

For the synthesis, state your calibrated probability estimate for YES resolution and explain why. Reference the bull and bear arguments. If you lack domain knowledge to be confident, say so and reduce your confidence accordingly.

For signal: if your estimated probability is meaningfully higher than the implied price, say BUY. If meaningfully lower, say SELL. If roughly equal, say HOLD.

For confidence: 0.0 means pure guess, 0.5 means you have some signal but high uncertainty, 0.8+ means strong evidence, 1.0 means certainty (which you should almost never claim).

## Output format (respond with ONLY this JSON, no other text):
{{
  "bull": "Your bull case. 2-3 paragraphs. Cite specific facts, precedents, data points. Explain why YES is more likely than the market thinks.",
  "bear": "Your bear case. 2-3 paragraphs. Cite specific risks, base rates, counter-evidence. Explain why YES is less likely than the market thinks.",
  "synthesis": "Your calibrated probability assessment. 1-2 paragraphs. State your estimated % chance of YES resolution, reference your bull and bear arguments, and explain your confidence level. If you lack domain knowledge, say so.",
  "signal": "BUY or SELL or HOLD",
  "confidence": 0.0 to 1.0
}}"""

    response = litellm.completion(
        model="deepseek/deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=3000,
    )

    content = response.choices[0].message.content or ""

    # Extract JSON from response (handle markdown code blocks)
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        # Try to find raw JSON object
        json_match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", content, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            raise TradingAgentsInferenceError(f"Could not parse JSON from DeepSeek response: {content[:300]}")

    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise TradingAgentsInferenceError(f"Invalid JSON from DeepSeek: {e}") from e

    signal = str(parsed.get("signal", "HOLD")).strip().upper()
    conf = float(parsed.get("confidence", 0.5))
    conf = max(0.0, min(1.0, conf))

    rating = map_signal_to_rating(signal, conf)
    confidence_bps = confidence_to_bps(conf)

    return {
        "bull": str(parsed.get("bull", "")),
        "bear": str(parsed.get("bear", "")),
        "synthesis": str(parsed.get("synthesis", "")),
        "rating": rating,
        "confidence_bps": confidence_bps,
    }
