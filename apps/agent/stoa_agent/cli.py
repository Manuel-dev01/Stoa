from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone


def cmd_register(args: argparse.Namespace) -> None:
    from stoa_agent.chain.client import ArcClient
    from stoa_agent.config import load_settings

    settings = load_settings()
    client = ArcClient(settings)
    agent_id = client.register_agent()
    print(f"Agent ID: {agent_id}")
    print("Copy this into .env.local as AGENT_ID, then restart the service.")


def cmd_publish_trace(args: argparse.Namespace) -> None:
    from stoa_agent.chain.client import ArcClient
    from stoa_agent.config import load_settings
    from stoa_agent.errors import GammaApiError, IrysUploadError, ArcSubmitError, TradingAgentsInferenceError, MarketIdMismatchError, MarketNotFoundError
    from stoa_agent.polymarket.gamma import get_market
    from stoa_agent.reasoning.runner import run_inference_direct
    from stoa_agent.schemas import (
        Trace, TraceDecision, TraceMarket, TraceModelMetadata, TraceReasoning,
    )
    from stoa_agent.storage.irys import compute_trace_hash, upload_trace

    settings = load_settings()
    os.environ["DEEPSEEK_API_KEY"] = settings.deepseek_api_key

    if settings.agent_id is None:
        print("Error: AGENT_ID not set in .env.local. Run 'register' first.", file=sys.stderr)
        sys.exit(1)

    market_id = args.market_id

    # 1. Fetch market
    print(f"Fetching market {market_id}...")
    try:
        market = asyncio.run(get_market(market_id))
    except (GammaApiError, MarketNotFoundError) as e:
        print(f"Error fetching market: {e}", file=sys.stderr)
        sys.exit(1)
    if market.condition_id.lower() != market_id.lower():
        print(f"Error: market ID mismatch: requested {market_id}, got {market.condition_id}", file=sys.stderr)
        sys.exit(1)
    print(f"Market: {market.question}")
    print(f"Outcomes: {market.outcomes}, Liquidity: ${market.liquidity:,.0f}")

    # 2. Run inference (DeepSeek primary)
    print("Running DeepSeek inference...")
    try:
        inference = run_inference_direct(market)
    except TradingAgentsInferenceError as e:
        print(f"Error running inference: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"Rating: {inference['rating']:+d}, Confidence: {inference['confidence_bps'] / 100:.0f}%")
    print(f"Synthesis: {inference['synthesis'][:200]}...")

    # 3. Build trace
    trace = Trace(
        agent_id=settings.agent_id,
        market_id=market_id,
        generated_at=datetime.now(timezone.utc),
        market=TraceMarket(question=market.question, resolution_at=None),
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

    # 4. Upload to Irys
    print("Uploading trace to Irys...")
    try:
        irys_receipt = asyncio.run(upload_trace(trace_dict, settings))
    except IrysUploadError as e:
        print(f"Error uploading to Irys: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"Irys receipt: {irys_receipt}")

    # 5. Hash
    trace_hash = compute_trace_hash(trace_dict)
    print(f"Trace hash: {trace_hash}")

    # 6. Publish to Arc
    print("Publishing to Arc...")
    arc_client = ArcClient(settings)
    try:
        arc_tx_hash = arc_client.publish_trace(
            agent_id=settings.agent_id,
            market_id=market_id,
            trace_hash=trace_hash,
            rating=inference["rating"],
            confidence_bps=inference["confidence_bps"],
            irys_receipt=irys_receipt,
        )
    except ArcSubmitError as e:
        print(f"Error publishing to Arc: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Arc tx hash: {arc_tx_hash}")
    print("\n--- Receipt ---")
    print(f"trace_hash: {trace_hash}")
    print(f"irys_receipt: {irys_receipt}")
    print(f"arc_tx_hash: {arc_tx_hash}")
    print(f"irys_url: https://gateway.irys.xyz/{irys_receipt}")


def cmd_autonomous(args: argparse.Namespace) -> None:
    from stoa_agent.config import load_settings
    from stoa_agent.loop import AgentLoop

    settings = load_settings()
    os.environ["DEEPSEEK_API_KEY"] = settings.deepseek_api_key

    if settings.agent_id is None:
        print("Error: AGENT_ID not set in .env.local. Run 'register' first.", file=sys.stderr)
        sys.exit(1)

    interval = args.interval or settings.loop_interval_seconds
    min_confidence = args.min_confidence or settings.loop_min_confidence_bps
    max_markets = args.max_markets or settings.loop_max_markets_per_cycle

    loop = AgentLoop(
        settings=settings,
        interval_seconds=interval,
        min_liquidity=settings.loop_min_liquidity,
        min_confidence_bps=min_confidence,
        max_markets_per_cycle=max_markets,
    )

    print(f"Starting autonomous loop (interval={interval}s, min_confidence={min_confidence / 100:.0f}%, max_markets={max_markets})")
    print(f"Agent ID: {settings.agent_id}")

    try:
        asyncio.run(loop.run())
    except KeyboardInterrupt:
        print("\nLoop stopped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Stoa agent CLI")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("register", help="Register the agent on StoaRegistry")

    publish_parser = sub.add_parser("publish-trace", help="Publish a trace for a market")
    publish_parser.add_argument("--market-id", required=True, help="Polymarket condition_id (0x...)")

    auto_parser = sub.add_parser("autonomous", help="Run the autonomous market analysis loop")
    auto_parser.add_argument("--interval", type=int, default=None, help="Poll interval in seconds")
    auto_parser.add_argument("--min-confidence", type=int, default=None, help="Minimum confidence BPS to publish")
    auto_parser.add_argument("--max-markets", type=int, default=None, help="Max markets per cycle")

    args = parser.parse_args()

    if args.command == "register":
        cmd_register(args)
    elif args.command == "publish-trace":
        cmd_publish_trace(args)
    elif args.command == "autonomous":
        cmd_autonomous(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
