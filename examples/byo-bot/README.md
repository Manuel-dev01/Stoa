# Bring Your Own Bot

Wire any trading bot to the Stoa macro-alpha feed in ~20 lines. No subscription,
no API key — the feed is gated by an HTTP 402 x402 nanopayment toll on Arc.

```bash
pip install requests web3
export ARC_RPC=https://...        # Arc testnet RPC
export BOT_PRIVATE_KEY=0x...      # a wallet with a little Arc USDC
python consume_feed.py
```

What happens:

1. `GET /api/v1/feeds/macro-alpha` → **HTTP 402** with `payment_terms`.
2. The bot pays the sub-cent USDC toll to the Stoa Treasury on Arc (clears in <500ms).
3. The bot retries with `X-402-Payment-Receipt: <tx hash>`.
4. The server verifies the tx settled on Arc, paid the toll, and isn't replayed,
   then returns the feed — each item carrying the Triad's synthesis, a fractional
   Kelly stake, and an immutable Irys trace hash.

Each receipt is single-use (replay-protected). Re-running pays a fresh toll.
