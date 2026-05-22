# Refactor Backlog

Known shortcuts and technical debt. Don't fix during the hackathon unless it blocks something.

## `any` cast in polymarket.ts buildSignedOrder

`signedOrder` from `client.createOrder()` returns `SignedOrder` (union of V1 | V2). TypeScript can't narrow the union fields (e.g. `timestamp` is `EIP712ObjectValue` = `string | number`, not `string`). Cast to `any` for clean extraction. Per CLAUDE.md S10 this is acceptable when working around untyped external library responses. Fix: contribute V2-specific return type upstream or add a local type guard.

## Polymarket proxy wallet — resolved (Day 8), broadcast blocked (Day 9)

The "maker address not allowed" error was caused by using EOA signature type instead of POLY_1271. The proxy wallet (`0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a`) already existed — created by Polymarket's UI when the agent EOA first deposited. Resolution:

1. Proxy wallet discovered via Polygonscan tx history + relayer API confirmation
2. ClobClient configured with `signatureType: SignatureTypeV2.POLY_1271` + `funderAddress: proxy`
3. API credentials re-derived from agent EOA (old signing wallet credentials don't work with agent's proxy)
4. CTFExchangeV2 approvals already set to MAX_UINT256 (no approval tx needed)
5. Dry-run order signed successfully with correct maker/signer/builder fields

Remaining blocker: CLOB API rejects all POLY_1271 orders with "the order signer address has to be the address of the API KEY". The proxy wallet's ERC-1967 implementation slot is `0x0` (not deployed through official relayer). Full root cause in `docs/archive/phase-2-polymarket-broadcast.md`. Resolution requires Builder API credentials + relayer access from a different network environment.

## Vercel env vars — resolved (Day 11)

Polymarket server-side env vars and treasury address were missing from both `apps/web/.env.local` and Vercel project settings. The route-order API returned "POLYMARKET_PRIVATE_KEY not set" on Vercel, and treasury features showed "--". Fixed by adding 7 env vars to Vercel and syncing local `.env.local`. `next.config.ts` also updated to include `@stoa/sdk` in `transpilePackages`.
