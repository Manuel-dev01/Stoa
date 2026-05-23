"""
Batch create Circle wallets, fund them with USDC, and register agents on StoaRegistry.

Usage: cd apps/agent && uv run python ../../scripts/create-and-register-agents.py

Outputs: scripts/agents/wallets.json with all agent details.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Add agent module to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "agent"))

from stoa_agent.chain.circle_client import CircleArcClient, create_circle_wallet
from stoa_agent.chain.client import ArcClient
from stoa_agent.config import load_settings
from web3 import Web3
from eth_account import Account

PERSONAS = [
    "stoikos", "stoikos", "stoikos", "stoikos",
    "heraklit", "heraklit", "heraklit", "heraklit",
    "phyrr", "phyrr", "phyrr", "phyrr",
    "artemis", "artemis", "artemis", "artemis",
    "athena", "athena", "athena", "athena",
    "hermes", "hermes", "hermes", "hermes",
    "stoikos",
]

PERSONA_PROMPTS = {
    "stoikos": "You are a calibrated prediction market analyst. Your goal is accuracy, not persuasion. Think in terms of calibrated probabilities. Cite specific facts and data points.",
    "heraklit": "You are a momentum-focused prediction market analyst. You follow trends, recent developments, and building narratives. When evidence is building in one direction, you lean into it rather than looking for contrarian reversals. You pay attention to news flow and market sentiment.",
    "phyrr": "You are a contrarian prediction market analyst. You actively look for reasons the market consensus is wrong. You focus on base rates, regression to the mean, and the wisdom of betting against overreactions. You are skeptical of narratives and prefer statistical reasoning.",
    "artemis": "You are an event-driven prediction market analyst. You focus on specific upcoming catalysts, deadlines, and decision points. You think about what needs to happen for the outcome to resolve YES or NO, and how likely each required event is.",
    "athena": "You are a fundamental prediction market analyst. You focus on structural factors, institutional incentives, and long-term trends. You think about the deep reasons why something is likely or unlikely, not just surface-level news.",
    "hermes": "You are a technical prediction market analyst. You focus on market microstructure, liquidity patterns, and what the current price implies about probabilities. You think about whether the market is efficiently pricing in available information.",
}

WALLETS_FILE = Path(__file__).parent / "agents" / "wallets.json"
NUM_AGENTS = 25
FUND_AMOUNT_ETH = "0.5"  # 0.5 USDC per wallet (native on Arc)


def main():
    settings = load_settings()
    w3 = Web3(Web3.HTTPProvider(settings.arc_testnet_rpc))
    funder = Account.from_key(settings.agent_private_key)

    print(f"Funder: {funder.address}")
    funder_balance = w3.eth.get_balance(funder.address)
    print(f"Funder balance: {w3.from_wei(funder_balance, 'ether')} USDC")

    needed = float(FUND_AMOUNT_ETH) * NUM_AGENTS
    available = float(w3.from_wei(funder_balance, 'ether'))
    if available < needed + 1:  # +1 for buffer
        print(f"WARNING: Need ~{needed + 1} USDC but only have {available:.2f}. Proceeding anyway...")

    # Load existing wallets if any
    agents = []
    if WALLETS_FILE.exists():
        agents = json.loads(WALLETS_FILE.read_text())
        print(f"Loaded {len(agents)} existing agents from wallets.json")

    circle_client = CircleArcClient(settings)

    for i in range(len(agents), NUM_AGENTS):
        persona = PERSONAS[i % len(PERSONAS)]
        print(f"\n--- Agent {i + 1}/{NUM_AGENTS} (persona: {persona}) ---")

        # Step 1: Create Circle wallet
        print("Creating Circle wallet...")
        try:
            wallet = create_circle_wallet(
                settings.circle_api_key,
                settings.circle_entity_secret,
                settings.circle_wallet_set_id,
            )
            print(f"  Wallet: {wallet['address']} (ID: {wallet['wallet_id']})")
        except Exception as e:
            print(f"  FAILED to create wallet: {e}")
            continue

        # Step 2: Fund with USDC
        print(f"Funding with {FUND_AMOUNT_ETH} USDC...")
        try:
            fund_tx = {
                "from": funder.address,
                "to": Web3.to_checksum_address(wallet["address"]),
                "value": w3.to_wei(float(FUND_AMOUNT_ETH), "ether"),
                "nonce": w3.eth.get_transaction_count(funder.address),
                "gas": 21000,
                "gasPrice": w3.eth.gas_price,
                "chainId": w3.eth.chain_id,
            }
            signed = funder.sign_transaction(fund_tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
            if receipt["status"] != 1:
                print(f"  FAILED to fund: tx reverted")
                continue
            balance = w3.eth.get_balance(Web3.to_checksum_address(wallet["address"]))
            print(f"  Funded. Balance: {w3.from_wei(balance, 'ether')} USDC")
        except Exception as e:
            print(f"  FAILED to fund: {e}")
            continue

        # Step 3: Register agent
        print("Registering agent...")
        try:
            agent_id = circle_client.register_agent(wallet_id=wallet["wallet_id"])
            print(f"  Agent ID: {agent_id}")
        except Exception as e:
            print(f"  FAILED to register: {e}")
            # Still save the wallet even if registration failed
            agent_id = None

        agent_entry = {
            "index": i + 1,
            "wallet_id": wallet["wallet_id"],
            "address": wallet["address"],
            "agent_id": agent_id,
            "persona": persona,
        }
        agents.append(agent_entry)

        # Save incrementally
        WALLETS_FILE.write_text(json.dumps(agents, indent=2))
        print(f"  Saved to wallets.json ({len(agents)} total)")

        # Brief pause to avoid rate limits
        time.sleep(1)

    print(f"\n=== Done! {len(agents)} agents created. ===")
    registered = sum(1 for a in agents if a.get("agent_id"))
    print(f"Registered: {registered}/{len(agents)}")


if __name__ == "__main__":
    main()
