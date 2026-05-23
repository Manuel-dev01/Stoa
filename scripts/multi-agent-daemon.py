"""
Multi-agent daemon — cycles through all registered agents continuously.

Each cycle: for each agent, pick one unpublished market, run inference, publish.
Sequential execution (~30s per agent, ~12.5 min per full cycle for 25 agents).

Usage: cd apps/agent && uv run python ../../scripts/multi-agent-daemon.py

Requires: scripts/agents/wallets.json with registered agents.
"""

from __future__ import annotations

import asyncio
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "agent"))

from stoa_agent.chain.circle_client import CircleArcClient
from stoa_agent.config import Settings, load_settings
from stoa_agent.errors import ArcSubmitError, IrysUploadError
from stoa_agent.polymarket.gamma import Market, get_active_markets
from stoa_agent.kalshi.client import get_kalshi_markets
from stoa_agent.reasoning.runner import run_inference_direct
from stoa_agent.schemas import (
    Trace,
    TraceDecision,
    TraceMarket,
    TraceModelMetadata,
    TraceReasoning,
)
from stoa_agent.storage.irys import compute_trace_hash, upload_trace

WALLETS_FILE = Path(__file__).parent / "agents" / "wallets.json"
CYCLE_INTERVAL = 600  # 10 minutes between full cycles
MIN_CONFIDENCE_BPS = 4000

PERSONA_PROMPTS = {
    "stoikos": "You are a calibrated prediction market analyst. Your goal is accuracy, not persuasion. Think in terms of calibrated probabilities. Cite specific facts and data points.",
    "heraklit": "You are a momentum-focused prediction market analyst. You follow trends, recent developments, and building narratives. When evidence is building in one direction, you lean into it. You pay attention to news flow and market sentiment.",
    "phyrr": "You are a contrarian prediction market analyst. You actively look for reasons the market consensus is wrong. You focus on base rates, regression to the mean, and betting against overreactions. You are skeptical of narratives.",
    "artemis": "You are an event-driven prediction market analyst. You focus on specific upcoming catalysts, deadlines, and decision points. You think about what needs to happen for the outcome to resolve YES or NO.",
    "athena": "You are a fundamental prediction market analyst. You focus on structural factors, institutional incentives, and long-term trends. You think about deep reasons, not surface-level news.",
    "hermes": "You are a technical prediction market analyst. You focus on market microstructure, liquidity patterns, and what the current price implies. You think about whether the market is efficiently pricing in information.",
}


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


async def fetch_markets() -> list[Market]:
    markets: list[Market] = []
    try:
        pm = await get_active_markets(min_liquidity=2000, limit=40)
        markets.extend(pm)
    except Exception:
        pass
    try:
        km = await get_kalshi_markets(limit=40)
        markets.extend(km)
    except Exception:
        pass
    random.shuffle(markets)
    return markets


async def publish_trace(
    settings: Settings,
    circle_client: CircleArcClient,
    agent: dict,
    market: Market,
) -> bool:
    persona = PERSONA_PROMPTS.get(agent.get("persona", "stoikos"), PERSONA_PROMPTS["stoikos"])
    venue = "kalshi" if market.condition_id.startswith("kalshi:") else "polymarket"

    try:
        inference = run_inference_direct(market, persona=persona)
    except Exception as e:
        log(f"    Inference error: {e}")
        return False

    if inference["confidence_bps"] < MIN_CONFIDENCE_BPS:
        log(f"    Low confidence ({inference['confidence_bps'] / 100:.0f}%), skipping")
        return False

    trace = Trace(
        agent_id=agent["agent_id"],
        market_id=market.condition_id,
        generated_at=datetime.now(timezone.utc),
        market=TraceMarket(question=market.question, venue=venue, resolution_at=None),
        reasoning=TraceReasoning(
            bull=inference["bull"],
            bear=inference["bear"],
            synthesis=inference["synthesis"],
        ),
        decision=TraceDecision(
            rating=inference["rating"],
            confidence_bps=inference["confidence_bps"],
        ),
        model_metadata=TraceModelMetadata(),
    )
    trace_dict = trace.model_dump(mode="json")

    try:
        irys_receipt = await upload_trace(trace_dict, settings)
    except IrysUploadError as e:
        log(f"    Irys error: {e}")
        return False

    trace_hash = compute_trace_hash(trace_dict)

    if venue == "kalshi":
        log(f"    PUBLISHED (Irys-only, Kalshi): {inference['rating']:+d}")
        return True

    try:
        arc_tx = circle_client.publish_trace(
            agent_id=agent["agent_id"],
            market_id=market.condition_id,
            trace_hash=trace_hash,
            rating=inference["rating"],
            confidence_bps=inference["confidence_bps"],
            irys_receipt=irys_receipt,
            wallet_id=agent["wallet_id"],
        )
        log(f"    Arc: {arc_tx[:16]}...")
        log(f"    PUBLISHED: {inference['rating']:+d} @ {inference['confidence_bps'] / 100:.0f}%")
        return True
    except ArcSubmitError as e:
        log(f"    Arc error: {e}")
        return False


async def main():
    if not WALLETS_FILE.exists():
        print("ERROR: wallets.json not found.")
        return

    agents = [a for a in json.loads(WALLETS_FILE.read_text()) if a.get("agent_id")]
    if not agents:
        print("No registered agents.")
        return

    settings = load_settings()
    circle_client = CircleArcClient(settings)

    # Track published markets per agent (in-memory, resets on restart)
    published: dict[str, set[str]] = {a["agent_id"]: set() for a in agents}

    log(f"Starting multi-agent daemon: {len(agents)} agents, {CYCLE_INTERVAL}s cycle")

    cycle = 0
    while True:
        cycle += 1
        log(f"\n{'=' * 50}")
        log(f"CYCLE {cycle}")
        log(f"{'=' * 50}")

        markets = await fetch_markets()
        if not markets:
            log("No markets available, sleeping...")
            await asyncio.sleep(CYCLE_INTERVAL)
            continue

        log(f"Fetched {len(markets)} markets")

        cycle_published = 0
        for agent in agents:
            agent_id = agent["agent_id"]
            persona = agent.get("persona", "stoikos")

            # Pick a market this agent hasn't published on
            available = [m for m in markets if m.condition_id.lower() not in published[agent_id]]
            if not available:
                log(f"  Agent {agent['index']} ({persona}): no new markets")
                continue

            market = available[0]
            log(f"  Agent {agent['index']} ({persona}): {market.question[:50]}...")

            success = await publish_trace(settings, circle_client, agent, market)
            if success:
                published[agent_id].add(market.condition_id.lower())
                cycle_published += 1

            await asyncio.sleep(1)  # Brief pause between agents

        log(f"Cycle {cycle} done: {cycle_published} traces published")
        log(f"Sleeping {CYCLE_INTERVAL}s until next cycle...")
        await asyncio.sleep(CYCLE_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
