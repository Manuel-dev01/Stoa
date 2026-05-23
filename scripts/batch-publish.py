"""
Batch publish traces for all registered agents.

For each agent: fetch markets, run inference with persona, upload to Irys, publish on-chain.
Each agent publishes on different markets to avoid duplicates.

Usage: cd apps/agent && uv run python ../../scripts/batch-publish.py

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
TRACES_PER_AGENT = 4
MIN_CONFIDENCE_BPS = 4000  # 40% minimum


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


async def fetch_all_markets() -> list[Market]:
    """Fetch markets from both Polymarket and Kalshi."""
    markets: list[Market] = []

    try:
        pm = await get_active_markets(min_liquidity=2000, limit=50)
        markets.extend(pm)
        log(f"Fetched {len(pm)} Polymarket markets")
    except Exception as e:
        log(f"Polymarket fetch failed: {e}")

    try:
        km = await get_kalshi_markets(limit=50)
        markets.extend(km)
        log(f"Fetched {len(km)} Kalshi markets")
    except Exception as e:
        log(f"Kalshi fetch failed: {e}")

    random.shuffle(markets)
    return markets


async def publish_one_trace(
    settings: Settings,
    circle_client: CircleArcClient,
    agent: dict,
    market: Market,
) -> bool:
    """Publish one trace for an agent on a market. Returns True on success."""
    persona_map = {
        "stoikos": "You are a calibrated prediction market analyst. Your goal is accuracy, not persuasion. Think in terms of calibrated probabilities. Cite specific facts and data points.",
        "heraklit": "You are a momentum-focused prediction market analyst. You follow trends, recent developments, and building narratives. When evidence is building in one direction, you lean into it. You pay attention to news flow and market sentiment.",
        "phyrr": "You are a contrarian prediction market analyst. You actively look for reasons the market consensus is wrong. You focus on base rates, regression to the mean, and betting against overreactions. You are skeptical of narratives.",
        "artemis": "You are an event-driven prediction market analyst. You focus on specific upcoming catalysts, deadlines, and decision points. You think about what needs to happen for the outcome to resolve YES or NO.",
        "athena": "You are a fundamental prediction market analyst. You focus on structural factors, institutional incentives, and long-term trends. You think about deep reasons, not surface-level news.",
        "hermes": "You are a technical prediction market analyst. You focus on market microstructure, liquidity patterns, and what the current price implies. You think about whether the market is efficiently pricing in information.",
    }

    persona = persona_map.get(agent.get("persona", "stoikos"), persona_map["stoikos"])
    venue = "kalshi" if market.condition_id.startswith("kalshi:") else "polymarket"

    # Run inference
    try:
        inference = run_inference_direct(market, persona=persona)
    except Exception as e:
        log(f"  Inference failed: {e}")
        return False

    if inference["confidence_bps"] < MIN_CONFIDENCE_BPS:
        log(f"  Skipped: confidence {inference['confidence_bps'] / 100:.0f}% below threshold")
        return False

    # Build trace
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

    # Upload to Irys
    try:
        irys_receipt = await upload_trace(trace_dict, settings)
        log(f"  Irys: {irys_receipt}")
    except IrysUploadError as e:
        log(f"  Irys failed: {e}")
        return False

    trace_hash = compute_trace_hash(trace_dict)

    # Kalshi: Irys-only, no on-chain
    if venue == "kalshi":
        log(f"  PUBLISHED (Irys-only): rating={inference['rating']:+d} conf={inference['confidence_bps'] / 100:.0f}%")
        return True

    # Publish on-chain via Circle
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
        log(f"  Arc tx: {arc_tx}")
        log(f"  PUBLISHED: rating={inference['rating']:+d} conf={inference['confidence_bps'] / 100:.0f}%")
        return True
    except ArcSubmitError as e:
        log(f"  Arc publish failed: {e}")
        return False


async def main():
    if not WALLETS_FILE.exists():
        print("ERROR: wallets.json not found. Run create-and-register-agents.py first.")
        return

    agents = json.loads(WALLETS_FILE.read_text())
    registered = [a for a in agents if a.get("agent_id")]
    print(f"Found {len(registered)} registered agents")

    if not registered:
        print("No registered agents. Run create-and-register-agents.py first.")
        return

    settings = load_settings()
    circle_client = CircleArcClient(settings)

    # Fetch all available markets
    all_markets = await fetch_all_markets()
    if not all_markets:
        print("No markets available.")
        return

    # Track which markets each agent has published on
    agent_published: dict[str, set[str]] = {a["agent_id"]: set() for a in registered}
    total_published = 0
    total_failed = 0

    for agent in registered:
        agent_id = agent["agent_id"]
        persona = agent.get("persona", "stoikos")
        log(f"\n=== Agent {agent['index']}: {agent_id[:16]}... (persona: {persona}) ===")

        # Select markets this agent hasn't published on
        available = [m for m in all_markets if m.condition_id.lower() not in agent_published[agent_id]]
        selected = available[:TRACES_PER_AGENT]

        for market in selected:
            log(f"  Market: {market.question[:60]}...")
            success = await publish_one_trace(settings, circle_client, agent, market)
            if success:
                agent_published[agent_id].add(market.condition_id.lower())
                total_published += 1
            else:
                total_failed += 1
            await asyncio.sleep(2)  # Brief pause between traces

    log(f"\n=== Batch publish complete ===")
    log(f"Published: {total_published}, Failed: {total_failed}")
    log(f"Agents: {len(registered)}, Traces per agent: ~{total_published // max(len(registered), 1)}")


if __name__ == "__main__":
    asyncio.run(main())
