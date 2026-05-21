# Refactor Backlog

Known shortcuts and technical debt. Don't fix during the hackathon unless it blocks something.

## `any` cast in polymarket.ts buildSignedOrder

`signedOrder` from `client.createOrder()` returns `SignedOrder` (union of V1 | V2). TypeScript can't narrow the union fields (e.g. `timestamp` is `EIP712ObjectValue` = `string | number`, not `string`). Cast to `any` for clean extraction. Per CLAUDE.md S10 this is acceptable when working around untyped external library responses. Fix: contribute V2-specific return type upstream or add a local type guard.

## Polymarket proxy wallet — resolved (Day 8)

The "maker address not allowed" error was caused by using EOA signature type instead of POLY_1271. The proxy wallet (`0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a`) already existed — created by Polymarket's UI when the agent EOA first deposited. Resolution:

1. Proxy wallet discovered via Polygonscan tx history + relayer API confirmation
2. ClobClient configured with `signatureType: SignatureTypeV2.POLY_1271` + `funderAddress: proxy`
3. API credentials re-derived from agent EOA (old signing wallet credentials don't work with agent's proxy)
4. CTFExchangeV2 approvals already set to MAX_UINT256 (no approval tx needed)
5. Dry-run order signed successfully with correct maker/signer/builder fields

Remaining blocker: proxy wallet has 0 pUSD balance. Fund with pUSD (`0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB`) to the proxy address, then sync CLOB balance via `GET /balance-allowance/update?asset_type=COLLATERAL&signature_type=3`.
