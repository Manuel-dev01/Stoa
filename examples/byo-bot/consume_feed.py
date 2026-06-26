"""Bring Your Own Bot — pay the x402 toll and ingest the Stoa macro-alpha feed.

A trading bot hits the feed, gets HTTP 402, pays a sub-cent USDC toll to the
Stoa Treasury on Arc, retries with the receipt header, and prints the Kelly
fractions. This is the whole consumer integration — ~20 lines of real logic.

  pip install requests web3
  export ARC_RPC=https://...            # Arc testnet RPC
  export BOT_PRIVATE_KEY=0x...          # funded with a little Arc USDC
  python consume_feed.py
"""

import os
import requests
from web3 import Web3

FEED_URL = os.environ.get("FEED_URL", "https://stoa-agents.vercel.app/api/v1/feeds/macro-alpha")
# Arc USDC ERC-20 (6 decimals). Override via ARC_USDC if it differs.
ARC_USDC = os.environ.get("ARC_USDC", "0x3600000000000000000000000000000000000000")
ERC20_TRANSFER_ABI = [{
    "name": "transfer", "type": "function", "stateMutability": "nonpayable",
    "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "outputs": [{"name": "", "type": "bool"}],
}]
w3 = Web3(Web3.HTTPProvider(os.environ["ARC_RPC"]))
acct = w3.eth.account.from_key(os.environ["BOT_PRIVATE_KEY"])


def pay_toll(terms: dict) -> str:
    """ERC-20 USDC transfer of the toll to the Treasury on Arc (6 decimals)."""
    usdc = w3.eth.contract(address=Web3.to_checksum_address(ARC_USDC), abi=ERC20_TRANSFER_ABI)
    amount = int(round(float(terms["amount"]) * 10**6))
    tx = usdc.functions.transfer(Web3.to_checksum_address(terms["pay_to"]), amount).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 120_000,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id,
    })
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    return tx_hash.hex()


def main() -> None:
    resp = requests.get(FEED_URL)
    if resp.status_code == 402:
        terms = resp.json()["payment_terms"]
        print(f"402 → paying {terms['amount']} USDC to {terms['pay_to']} on Arc…")
        receipt = pay_toll(terms)
        print(f"paid: {receipt}")
        resp = requests.get(FEED_URL, headers={"X-402-Payment-Receipt": receipt})

    resp.raise_for_status()
    feed = resp.json()
    print(f"\nUnlocked {len(feed['items'])} alpha items:\n")
    for item in feed["items"]:
        s = item["_stoa"]
        print(f"  {item['title'][:70]}")
        print(f"    rating={s['rating']:+d} conf={s['confidence_bps']/100:.0f}% "
              f"kelly={s['kelly_fraction']}  irys={s['irys_hash']}")


if __name__ == "__main__":
    main()
