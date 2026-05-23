from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone


def cmd_register(args: argparse.Namespace) -> None:
    from stoa_agent.chain.client import create_client
    from stoa_agent.config import load_settings

    settings = load_settings()
    client = create_client(settings)
    agent_id = client.register_agent()
    print(f"Agent ID: {agent_id}")
    print("Copy this into .env.local as AGENT_ID, then restart the service.")


def cmd_publish_trace(args: argparse.Namespace) -> None:
    from stoa_agent.chain.client import create_client
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
    arc_client = create_client(settings)
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


def cmd_circle_setup(args: argparse.Namespace) -> None:
    """Create a Circle wallet set and wallet for the agent."""
    from stoa_agent.chain.circle_client import create_circle_wallet
    from stoa_agent.config import load_settings

    settings = load_settings()
    if not settings.circle_api_key or not settings.circle_entity_secret:
        print("Error: CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set in .env.local", file=sys.stderr)
        sys.exit(1)

    agent_id = getattr(args, "agent_id", None)

    wallet_set_id = settings.circle_wallet_set_id or None

    if not wallet_set_id:
        print("Creating wallet set...")
    else:
        print(f"Using existing wallet set: {wallet_set_id}")

    print("Creating wallet on ARC-TESTNET...")
    result = create_circle_wallet(
        api_key=settings.circle_api_key,
        entity_secret=settings.circle_entity_secret,
        wallet_set_id=wallet_set_id,
    )

    print(f"\nWallet created successfully!")
    print(f"  Wallet ID:     {result['wallet_id']}")
    print(f"  Address:       {result['address']}")
    print(f"  Wallet Set ID: {result['wallet_set_id']}")

    if agent_id:
        # Per-agent wallet: store mapping in Supabase
        from stoa_agent.storage.supabase import save_agent_wallet
        try:
            save_agent_wallet(settings, agent_id, result["wallet_id"], result["address"])
            print(f"\nPer-agent wallet stored in Supabase for agent {agent_id}")
        except Exception as e:
            print(f"\nWarning: Could not store wallet in Supabase: {e}", file=sys.stderr)
            print("Manually add CIRCLE_WALLET_ID to .env.local if needed.")
    else:
        print(f"\nAdd these to apps/agent/.env.local:")
        print(f"  CIRCLE_WALLET_ID={result['wallet_id']}")
        print(f"  CIRCLE_WALLET_SET_ID={result['wallet_set_id']}")
        print(f"  USE_CIRCLE_WALLETS=true")


def cmd_circle_balance(args: argparse.Namespace) -> None:
    """Check the USDC balance of the Circle-managed agent wallet."""
    from stoa_agent.chain.circle_client import get_circle_balance
    from stoa_agent.config import load_settings

    settings = load_settings()
    if not settings.circle_api_key:
        print("Error: CIRCLE_API_KEY must be set in .env.local", file=sys.stderr)
        sys.exit(1)
    if not settings.circle_wallet_id:
        print("Error: CIRCLE_WALLET_ID not set. Run 'circle-setup' first.", file=sys.stderr)
        sys.exit(1)

    balances = get_circle_balance(settings.circle_api_key, settings.circle_wallet_id)
    if not balances:
        print("No token balances found.")
        return

    print(f"Wallet {settings.circle_wallet_id}:")
    for b in balances:
        print(f"  {b['symbol']}: {b['amount']}")


def _resolve_wallet_id(settings, agent_id: str | None) -> str:
    """Resolve the Circle wallet ID for an agent. Checks Supabase first, falls back to env."""
    if agent_id:
        from stoa_agent.storage.supabase import get_agent_wallet
        wallet = get_agent_wallet(settings, agent_id)
        if wallet:
            return wallet["wallet_id"]
    if settings.circle_wallet_id:
        return settings.circle_wallet_id
    print("Error: No Circle wallet found. Run 'circle-setup' first.", file=sys.stderr)
    sys.exit(1)


def cmd_circle_subscribe(args: argparse.Namespace) -> None:
    """Subscribe (deposit) USDC into an agent's treasury via Circle wallet."""
    from stoa_agent.chain.circle_client import CircleArcClient
    from stoa_agent.config import load_settings

    settings = load_settings()
    if not settings.circle_api_key:
        print("Error: CIRCLE_API_KEY must be set in .env.local", file=sys.stderr)
        sys.exit(1)
    if not settings.stoa_treasury_address:
        print("Error: STOA_TREASURY_ADDRESS must be set in .env.local", file=sys.stderr)
        sys.exit(1)

    agent_id = args.agent_id
    amount_usdc = args.amount
    amount_wei = int(amount_usdc * 1_000_000)  # USDC has 6 decimals

    wallet_id = _resolve_wallet_id(settings, agent_id)
    print(f"Using Circle wallet: {wallet_id}")

    client = CircleArcClient(settings)
    treasury = settings.stoa_treasury_address

    def _hex(v: str) -> str:
        return v if v.startswith("0x") else f"0x{v}"

    # Step 1: Approve USDC
    print(f"Approving {amount_usdc} USDC for treasury...")
    approve_hash = client.execute_on_contract(
        contract_address="0x3600000000000000000000000000000000000000",
        function_signature="approve(address,uint256)",
        parameters=[treasury, str(amount_wei)],
        wallet_id=wallet_id,
    )
    print(f"  Approve tx: {approve_hash}")

    # Step 2: Subscribe
    print(f"Subscribing {amount_usdc} USDC to agent {agent_id}...")
    subscribe_hash = client.execute_on_contract(
        contract_address=treasury,
        function_signature="subscribe(bytes32,uint256)",
        parameters=[_hex(agent_id), str(amount_wei)],
        wallet_id=wallet_id,
    )
    print(f"  Subscribe tx: {subscribe_hash}")
    print(f"\nDeposited {amount_usdc} USDC into treasury for agent {agent_id}")


def cmd_circle_redeem(args: argparse.Namespace) -> None:
    """Redeem shares from an agent's treasury via Circle wallet."""
    from stoa_agent.chain.circle_client import CircleArcClient
    from stoa_agent.config import load_settings

    settings = load_settings()
    if not settings.circle_api_key:
        print("Error: CIRCLE_API_KEY must be set in .env.local", file=sys.stderr)
        sys.exit(1)
    if not settings.stoa_treasury_address:
        print("Error: STOA_TREASURY_ADDRESS must be set in .env.local", file=sys.stderr)
        sys.exit(1)

    agent_id = args.agent_id
    shares = args.shares
    shares_wei = int(shares * 1_000_000)

    wallet_id = _resolve_wallet_id(settings, agent_id)
    print(f"Using Circle wallet: {wallet_id}")

    client = CircleArcClient(settings)

    def _hex(v: str) -> str:
        return v if v.startswith("0x") else f"0x{v}"

    print(f"Redeeming {shares} shares from agent {agent_id}...")
    redeem_hash = client.execute_on_contract(
        contract_address=settings.stoa_treasury_address,
        function_signature="redeem(bytes32,uint256)",
        parameters=[_hex(agent_id), str(shares_wei)],
        wallet_id=wallet_id,
    )
    print(f"  Redeem tx: {redeem_hash}")
    print(f"\nRedeemed {shares} shares from treasury for agent {agent_id}")


def cmd_circle_treasury(args: argparse.Namespace) -> None:
    """View an agent's treasury value and shares."""
    from web3 import Web3

    from stoa_agent.chain.abis import STOA_TREASURY_ABI
    from stoa_agent.config import load_settings

    settings = load_settings()
    if not settings.stoa_treasury_address:
        print("Error: STOA_TREASURY_ADDRESS must be set in .env.local", file=sys.stderr)
        sys.exit(1)

    agent_id = args.agent_id

    w3 = Web3(Web3.HTTPProvider(settings.arc_testnet_rpc))
    treasury = w3.eth.contract(
        address=Web3.to_checksum_address(settings.stoa_treasury_address),
        abi=STOA_TREASURY_ABI,
    )

    agent_id_bytes = bytes.fromhex(agent_id[2:] if agent_id.startswith("0x") else agent_id)
    value = treasury.functions.agentValue(agent_id_bytes).call()
    shares = treasury.functions.agentShares(agent_id_bytes).call()

    print(f"Agent: {agent_id}")
    print(f"  Treasury value: ${value / 1_000_000:.2f} USDC")
    print(f"  Shares: {shares / 1_000_000:.6f}")


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

    circle_setup_parser = sub.add_parser("circle-setup", help="Create a Circle wallet set and wallet for the agent")
    circle_setup_parser.add_argument("--agent-id", default=None, help="Create a per-agent wallet (stored in Supabase)")

    sub.add_parser("circle-balance", help="Check USDC balance of the Circle-managed wallet")

    circle_subscribe_parser = sub.add_parser("circle-subscribe", help="Deposit USDC into an agent's treasury via Circle wallet")
    circle_subscribe_parser.add_argument("--agent-id", required=True, help="Agent ID (0x...)")
    circle_subscribe_parser.add_argument("--amount", type=float, required=True, help="Amount in USDC")

    circle_redeem_parser = sub.add_parser("circle-redeem", help="Redeem shares from an agent's treasury via Circle wallet")
    circle_redeem_parser.add_argument("--agent-id", required=True, help="Agent ID (0x...)")
    circle_redeem_parser.add_argument("--shares", type=float, required=True, help="Number of shares to redeem")

    circle_treasury_parser = sub.add_parser("circle-treasury", help="View an agent's treasury value and shares")
    circle_treasury_parser.add_argument("--agent-id", required=True, help="Agent ID (0x...)")

    args = parser.parse_args()

    if args.command == "register":
        cmd_register(args)
    elif args.command == "publish-trace":
        cmd_publish_trace(args)
    elif args.command == "autonomous":
        cmd_autonomous(args)
    elif args.command == "circle-setup":
        cmd_circle_setup(args)
    elif args.command == "circle-balance":
        cmd_circle_balance(args)
    elif args.command == "circle-subscribe":
        cmd_circle_subscribe(args)
    elif args.command == "circle-redeem":
        cmd_circle_redeem(args)
    elif args.command == "circle-treasury":
        cmd_circle_treasury(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
