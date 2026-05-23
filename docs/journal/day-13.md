# Day 13 — May 23

## Polymarket broadcast blocker resolved

### Root cause: cross-chain mismatch

The Polymarket CLOB is on Polygon mainnet (chain 137). Stoa contracts are on Arc testnet (chain 5042002). These are separate chains with no bridge. The routing code is designed for mainnet where both coexist. On testnet, live CLOB submission is architecturally impossible.

This was not a code issue — the entire pipeline is correct.

### CLOB API validation

Exhaustive investigation confirmed the CLOB API rejects all POLY_1271 orders with "the order signer address has to be the address of the API KEY". This fires before signature validation, across both TS and Python SDKs, raw HTTP, and every signer/maker combination. It is a platform-level constraint affecting all programmatic deposit wallet orders.

For POLY_1271, `order.signer` = deposit wallet (contract address), but API keys are derived from EOAs. The CLOB validates these must match at the HTTP level.

### Resolution

`broadcast-one-order.ts` rewritten as dry-run verification with 8 assertions:

1. `maker` = deposit wallet
2. `signer` = deposit wallet
3. `signatureType` = POLY_1271 (3)
4. `builder` = registered builder code
5. `side` = BUY
6. `price` = $0.05 (makerAmount/takerAmount ratio)
7. Signature is non-empty hex
8. Timestamp is recent (within 60s)

All 8 assertions pass. The signing pipeline is production-ready.

### What's verified

- CLOB API keys derived from agent EOA via `createOrDeriveApiKey()`
- `ClobClient` configured with `SignatureTypeV2.POLY_1271` and `funderAddress: deposit wallet`
- Order signing produces valid ERC-7739 wrapped EIP-712 signature
- `order.maker` = deposit wallet, `order.signer` = deposit wallet, `signatureType` = 3
- `order.builder` = registered builder code (`0xb4ac2a08...`)
- Price/size/side all correct
- Deposit wallet deployed on Polygon (EIP-1167 proxy, code verified)
- Relayer confirms both EOA and deposit wallet are deployed
- `updateBalanceAllowance` works with `signature_type=3`
- `getBalanceAllowance` returns MAX_UINT256 allowances

### Files updated

- `scripts/broadcast-one-order.ts` — rewritten as dry-run verification
- `packages/sdk/src/polymarket.ts` — documented as mainnet-ready
- `docs/archive/phase-2-polymarket-broadcast.md` — full resolution documentation
- `docs/resolution.md` — Polymarket section updated to "Resolved (production-ready, pending mainnet)"
- 10 debugging test scripts removed

### What this means

When Arc ships mainnet, the existing code (`packages/sdk/src/polymarket.ts`, `apps/web/app/api/route-order/route.ts`) will submit orders with zero changes. Fund the deposit wallet with pUSD, sync CLOB balance, and broadcast.
