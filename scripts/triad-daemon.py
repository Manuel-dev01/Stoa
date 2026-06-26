"""Triad daemon — runs the three-engine Triad over the top macro/crypto markets.

Each cycle: fetch the top-N macro/crypto Polymarket markets, run
Quantec → Bayesian → Calibrator over each, anchor the synthesis on Irys + Arc,
and write the feed_items row the x402-gated feed serves.

Publishing is done under the Calibrator's agent identity (it owns the final
synthesis). The Quantec and Bayesian persist their own memory inside the Triad.

Usage: cd apps/agent && uv run python ../../scripts/triad-daemon.py

Requires: scripts/agents/wallets.json with a Calibrator agent entry.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "agent"))

from stoa_agent.chain.circle_client import CircleArcClient
from stoa_agent.config import Settings, load_settings
from stoa_agent.errors import ArcSubmitError, IrysUploadError
from stoa_agent.polymarket.gamma import Market, get_top_macro_crypto_markets
from stoa_agent.schemas import (
    Trace,
    TraceAgentBreakdown,
    TraceDecision,
    TraceMarket,
    TraceModelMetadata,
    TraceReasoning,
    TriadSubRead,
)
from stoa_agent.storage.irys import compute_trace_hash, upload_trace
from stoa_agent.triad import memory
from stoa_agent.triad.orchestrator import run_triad_for_market

WALLETS_FILE = Path(__file__).parent / "agents" / "wallets.json"
CYCLE_INTERVAL = int(os.environ.get("TRIAD_CYCLE_INTERVAL", "600"))  # 10 min
TOP_N = int(os.environ.get("TRIAD_TOP_N", "10"))
RUN_ONCE = os.environ.get("TRIAD_RUN_ONCE", "").lower() in ("1", "true", "yes")


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


def load_calibrator_agent() -> dict:
    """The agent that publishes the synthesis. Prefers the explicit calibrator."""
    if not WALLETS_FILE.exists():
        raise SystemExit("ERROR: scripts/agents/wallets.json not found.")
    agents = [a for a in json.loads(WALLETS_FILE.read_text()) if a.get("agent_id")]
    if not agents:
        raise SystemExit("ERROR: no registered agents in wallets.json.")
    for a in agents:
        if a.get("agent") == "calibrator" or a.get("persona") == "calibrator":
            return a
    return agents[0]


async def publish_feed_item(
    settings: Settings,
    circle_client: CircleArcClient,
    agent: dict,
    market: Market,
    cycle: int,
    synthesis: dict,
) -> bool:
    decision = synthesis["decision"]
    breakdown = synthesis["agent_breakdown"]

    trace = Trace(
        agent_id=agent["agent_id"],
        market_id=market.condition_id,
        generated_at=datetime.now(timezone.utc),
        market=TraceMarket(question=market.question, venue="polymarket", resolution_at=None),
        reasoning=TraceReasoning(**synthesis["reasoning"]),
        decision=TraceDecision(
            rating=decision["rating"],
            confidence_bps=decision["confidence_bps"],
            kelly_fraction=decision["kelly_fraction"],
        ),
        agent_breakdown=TraceAgentBreakdown(
            quantec=TriadSubRead(**breakdown["quantec"]),
            bayesian=TriadSubRead(**breakdown["bayesian"]),
            calibrator=TriadSubRead(**breakdown["calibrator"]),
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

    try:
        arc_tx = circle_client.publish_trace(
            agent_id=agent["agent_id"],
            market_id=market.condition_id,
            trace_hash=trace_hash,
            rating=decision["rating"],
            confidence_bps=decision["confidence_bps"],
            irys_receipt=irys_receipt,
            wallet_id=agent["wallet_id"],
        )
        log(f"    Arc: {arc_tx[:16]}…  rating={decision['rating']:+d} "
            f"conf={decision['confidence_bps'] / 100:.0f}% kelly={decision['kelly_fraction']:.3f}")
    except ArcSubmitError as e:
        log(f"    Arc error: {e}")
        return False

    # Write the feed_items row the x402 feed serves.
    await memory.write_feed_item(
        settings,
        {
            "market_id": market.condition_id,
            "question": market.question,
            "venue": "polymarket",
            "cycle": cycle,
            "rating": decision["rating"],
            "confidence_bps": decision["confidence_bps"],
            "kelly_fraction": decision["kelly_fraction"],
            "synthesis": {
                "reasoning": synthesis["reasoning"],
                "agent_breakdown": breakdown,
            },
            "irys_hash": irys_receipt,
            "trace_hash": trace_hash,
            "arc_tx_hash": arc_tx or "",
            "published_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return True


async def run_cycle(
    settings: Settings,
    circle_client: CircleArcClient,
    agent: dict,
    cycle: int,
) -> None:
    log(f"\n{'=' * 50}\nCYCLE {cycle}\n{'=' * 50}")
    try:
        markets = await get_top_macro_crypto_markets(top_n=TOP_N)
    except Exception as e:
        log(f"Market fetch failed: {e}")
        return
    if not markets:
        log("No macro/crypto markets in scope this cycle.")
        return
    log(f"Top {len(markets)} macro/crypto markets in scope.")

    published = 0
    for market in markets:
        log(f"  {market.question[:60]}…")
        try:
            synthesis = await run_triad_for_market(settings, market, cycle, agent["agent_id"])
        except Exception as e:
            log(f"    Triad error: {e}")
            continue
        if await publish_feed_item(settings, circle_client, agent, market, cycle, synthesis):
            published += 1

    log(f"Cycle {cycle} done: {published} feed items published.")


async def main() -> None:
    settings = load_settings()
    agent = load_calibrator_agent()
    circle_client = CircleArcClient(settings)
    log(f"Triad daemon up. Publishing as {agent.get('agent', 'calibrator')} "
        f"{agent['agent_id'][:18]}…  top_n={TOP_N}")

    cycle = 0
    while True:
        cycle += 1
        await run_cycle(settings, circle_client, agent, cycle)
        if RUN_ONCE:
            log("TRIAD_RUN_ONCE set — exiting after one cycle.")
            return
        log(f"Sleeping {CYCLE_INTERVAL}s until next cycle…")
        await asyncio.sleep(CYCLE_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
