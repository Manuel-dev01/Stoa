import os
import json
import httpx
from py_clob_client_v2 import ClobClient, ApiCreds, SignatureTypeV2, Side, OrderType, AssetType, BalanceAllowanceParams
from py_clob_client_v2.order_builder.constants import BUY

def main():
    agent_key = "0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40"
    proxy = "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a"

    creds = ApiCreds(
        api_key="7a658867-2edc-cc92-7c35-9f36475cda38",
        api_secret="sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=",
        api_passphrase="4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d",
    )

    print("Agent key:", agent_key[:20] + "...")
    print("Deposit wallet:", proxy)

    # Create client
    client = ClobClient(
        host="https://clob.polymarket.com",
        chain_id=137,
        key=agent_key,
        creds=creds,
        signature_type=SignatureTypeV2.POLY_1271,
        funder=proxy,
    )

    # Check balance
    print("\n=== Balance ===")
    try:
        bal = client.get_balance_allowance(BalanceAllowanceParams(asset_type=AssetType.COLLATERAL))
        print("Balance:", json.dumps(bal, indent=2))
    except Exception as e:
        print("Balance error:", e)

    # Fetch a market
    print("\n=== Market ===")
    resp = httpx.get("https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=5")
    markets = resp.json()
    token_id = ""
    for m in markets:
        raw = m.get("clobTokenIds")
        if raw:
            try:
                ids = json.loads(raw)
                if ids:
                    token_id = ids[0]
                    print("Market:", m.get("question"))
                    print("Token ID:", token_id)
                    break
            except:
                continue

    if not token_id:
        print("No market found")
        return

    # Get tick size
    tick_size = client.get_tick_size(token_id)
    print("Tick size:", tick_size)

    # Create and post order
    print("\n=== Creating order ===")
    try:
        from py_clob_client_v2 import OrderArgs, PartialCreateOrderOptions
        response = client.create_and_post_order(
            order_args=OrderArgs(
                token_id=token_id,
                price=0.05,
                size=1,
                side=BUY,
            ),
            options=PartialCreateOrderOptions(
                tick_size=tick_size,
                neg_risk=False,
            ),
            order_type=OrderType.GTC,
        )
        print("Result:", json.dumps(response, indent=2))
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
