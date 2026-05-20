# Refactor Backlog

Known shortcuts and technical debt. Don't fix during the hackathon unless it blocks something.

## `any` cast in polymarket.ts buildSignedOrder

`signedOrder` from `client.createOrder()` returns `SignedOrder` (union of V1 | V2). TypeScript can't narrow the union fields (e.g. `timestamp` is `EIP712ObjectValue` = `string | number`, not `string`). Cast to `any` for clean extraction. Per CLAUDE.md S10 this is acceptable when working around untyped external library responses. Fix: contribute V2-specific return type upstream or add a local type guard.
