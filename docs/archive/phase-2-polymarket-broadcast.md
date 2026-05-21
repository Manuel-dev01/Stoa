# Phase 2 Archive: Polymarket Live Broadcast — Unresolved Blocker

**Status:** Blocked  
**Date documented:** 2026-05-21  
**Phase:** 2 (The Routing)  
**Target exit criterion:** A Polymarket `OrderFilled` event with `builder` field matching our agent's `bytes32`, and the agent wallet's USDC balance increasing by the expected fee.

---

## What works

- CLOB API key derived from agent EOA (`0x5b92F8A2...`) via `createOrDeriveApiKey()`
- `ClobClient` configured with `signatureType: SignatureTypeV2.POLY_1271` (value 3) and `funderAddress: proxy`
- Order signing succeeds — SDK produces a valid ERC-7739 wrapped EIP-712 signature
- CLOB balance query returns 3 pUSD with MAX_UINT256 allowances for all three exchange contracts
- `orderToJsonV2` sends `side` as string ("BUY"/"SELL"), `taker` as undefined, `salt` as `parseInt(order.salt, 10)` — all correct
- Builder code `0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6` is registered on Polymarket V2

## The blocker

**CLOB API rejects ALL POLY_1271 orders with HTTP 400:**

```
"the order signer address has to be the address of the API KEY"
```

This fires regardless of configuration:
- Signer = proxy wallet address, maker = proxy wallet address
- Signer = EOA address, maker = proxy wallet address
- Signer = proxy wallet address, maker = EOA address
- With/without `funderAddress`
- With/without `builderConfig`
- Both TypeScript and Python SDKs
- Raw HTTP requests bypassing the SDK entirely
- Even with garbage signatures (error fires before signature validation)

The CLOB validates that `order.signer` matches the EOA that created the API key. For POLY_1271 orders, the SDK sets `signer = maker = proxy wallet address`. The API key was created by the agent EOA. These will never match.

## Root cause

The deposit wallet (`0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a`) was not deployed through the official Polymarket relayer flow. Evidence:

1. **ERC-1967 implementation slot is 0x0.** Polymarket's deposit wallets are ERC-1967 minimal proxies deployed by `DepositWalletFactory` (`0x00000000000Fb5C9ADea0298D729A0CB3823Cc07`). A properly deployed proxy has an implementation address set at storage slot `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`. This proxy has `0x0000...0000` at that slot.

2. **Cannot execute ERC-1271 `isValidSignature()`.** Without an implementation, the proxy has no code to validate signatures on-chain. The CLOB's off-chain validation likely checks for this and rejects the order before it reaches the exchange.

3. **Relayer unreachable.** `https://relayer.polymarket.com`, `https://relayer-v2.polymarket.com`, and `https://relayer.api.polymarket.com` all fail with fetch errors or 404s from our build environment. The relayer is required to deploy the proxy properly with the correct implementation address.

4. **Cannot create API keys for contract wallets.** CLOB L1 auth requires an EIP-712 signature where the `address` field matches the signer. An EOA cannot produce a valid signature claiming to be a contract wallet address.

## What we tried (exhaustive)

| Approach | Result |
|---|---|
| SDK default (signer = proxy, maker = proxy) | 400: signer must match API key address |
| Override signer to EOA before postOrder | 400: same error |
| Override signer to EOA after signing | 400: same error |
| Use signing wallet credentials with agent's proxy | 400: same error |
| Python `py-clob-client-v2` with same config | 400: same error |
| Raw HTTP POST with manual payload | 400: same error |
| No funderAddress, POLY_1271 only | 400: same error |
| Garbage signature (should fail validation, not auth) | 400: same error (fires before sig check) |
| Create API key with proxy wallet address | 401: Invalid L1 Request headers (EOA sig doesn't match proxy address) |
| Factory `deriveWalletAddress()` calls | No matching function selector on-chain |
| Relayer `/wallet?address=` endpoint | Connection refused / timeout |

## Resolution path

The deposit wallet must be deployed through the official Polymarket relayer flow using Builder API credentials (separate from CLOB API credentials).

### Steps

1. **Obtain Builder API credentials** from Polymarket (separate from CLOB trading keys). These are issued when you register as a builder at polymarket.com/settings.

2. **Use `@polymarket/builder-relayer-client`** to call the relayer's `WALLET-CREATE` endpoint. This deploys the ERC-1967 proxy with the correct implementation address and registers the EOA as the wallet owner.

3. **Verify the proxy** by checking that the ERC-1967 implementation slot is non-zero:
   ```
   cast storage $PROXY 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url polygon
   ```

4. **Re-derive CLOB API keys** from the agent EOA (if needed — current keys may still work).

5. **Configure ClobClient** with the working proxy and POLY_1271 signature type.

6. **Fund the proxy** with pUSD (`0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB`).

7. **Sync CLOB balance**: `GET /balance-allowance/update?asset_type=COLLATERAL&signature_type=3`

8. **Broadcast a test order** — $0.05 BUY on any active market.

### Why this wasn't resolved in Phase 2

The relayer is unreachable from our build environment (likely IP/geo/network restriction). The resolution requires either:
- Accessing the relayer from a different network environment
- Using the Polymarket UI to manually trigger deposit wallet creation (the UI calls the relayer internally)
- Getting Builder API credentials and calling the relayer programmatically from an environment where it's reachable

## Confirmed reference values

| Item | Value |
|---|---|
| Agent EOA | `0x5b92F8A222704d522Fb3dCf8d734C3DAF51Fc4f1` |
| Deposit wallet (proxy) | `0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a` |
| Factory | `0x00000000000Fb5C9ADea0298D729A0CB3823Cc07` |
| CTFExchangeV2 | `0xE111180000d2663C0091e4f400237545B87B996B` |
| pUSD | `0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB` |
| Builder code | `0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6` |
| API key (agent EOA) | `7a658867-2edc-cc92-7c35-9f36475cda38` |
| API key (signing EOA) | `42a8803c-4f65-d0a7-795a-617e3a491567` |
| Proxy CLOB balance | 3 pUSD (MAX_UINT256 approvals set) |
| Proxy ERC-1967 impl slot | `0x0000...0000` (not deployed) |

## Impact on Phase 2 exit criterion

The Phase 2 exit criterion requires: *"a Polymarket `OrderFilled` event with `builder` field matching our agent's `bytes32`, and the agent wallet's USDC balance increasing by the expected fee."*

This is not met. The routing pipeline (SDK config, order signing, builder attribution) is fully wired and tested in dry-run. The only missing piece is the live broadcast, blocked on deposit wallet deployment.

## Demo framing

In the judge's 60-second demo (Section 19 of CLAUDE.md), the Polymarket order broadcast is the `[0:32–0:48]` segment. If the deposit wallet is still unresolved at demo time, this segment can show:
1. The signed order with `builder` field set (dry-run proof)
2. The CLOB balance showing 3 pUSD in the proxy wallet
3. An explanation that the live broadcast requires the Polymarket relayer to deploy the proxy wallet — a one-time setup step that's blocked on network access to the relayer

The trace publishing pipeline (Irys + Arc) is fully operational and unaffected by this blocker.

---

*This document will be updated when the deposit wallet is resolved. The resolution path is clear — it's a network/environment access issue, not a code issue.*
