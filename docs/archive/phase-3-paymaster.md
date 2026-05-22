# Phase 3 Archive: Paymaster — Compiled, Not Proven

**Status:** Compiled, not proven  
**Date documented:** 2026-05-23  
**Phase:** 3 (The Surface)

---

## What works

- `apps/web/src/lib/paymaster.ts` — Circle Paymaster v0.8 integration. `createGasFreeAccount()`, `signPermit()`, `createPaymaster()`, `createGasFreeClient()` all compile and type-check.
- `useGasFreePublishTrace()` hook in `apps/web/src/lib/hooks.ts` — wraps bundler client for gas-free `publishTrace` calls on Arc testnet.
- EIP-2612 permit signing verified: `signTypedData` produces a valid permit signature for USDC → paymaster.
- Pimlico bundler accepted the UserOp and ran simulation. The bundler pipeline works end-to-end.
- Web app builds clean with all paymaster code included.

## The blocker

**Paymaster contract `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` is not deployed on the Canteen-hosted Arc testnet RPC.**

The Circle docs list this address as deployed on "Arc Testnet." The Canteen-hosted RPC at `rpc.testnet.arc-node.thecanteenapp.com` returns `0x` (no code) for both:
- v0.8: `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966`
- v0.7: `0x31BE08D380A21fc740883c0BC434FcFc88740b58`

This is the same class of failure as the Polymarket relayer: the code is correct, the external contract/infra is not reachable from this environment.

## What was tested

The full UserOp pipeline was executed:

1. `toSimple7702SmartAccount()` — smart account created at `0x5b92F8A222704d522Fb3dCf8d734C3DAF51Fc4f1`
2. EIP-2612 permit signed — USDC v2, nonce 0, spender = paymaster
3. `encodePacked(['uint8', 'address', 'uint256', 'bytes'], [0, usdc, permitAmount, permitSig])` — paymaster data encoded
4. `createBundlerClient()` with Pimlico endpoint — client created
5. `sendUserOperation()` — **failed with `AA30 paymaster not deployed`**

The error is `AA30` — the bundler simulates the UserOp and finds no code at the paymaster address. This is a contract-not-deployed error, not a code error.

## Resolution path

Find the correct RPC URL for the Arc testnet instance that has the Circle Paymaster deployed. Options:
1. Circle's own Arc testnet RPC (may differ from Canteen's hosted endpoint)
2. A different Arc testnet chain ID that Circle uses for paymaster deployment
3. Deploy a mock paymaster on the Canteen Arc testnet (for testing only)

## Files

- `apps/web/src/lib/paymaster.ts` — full implementation
- `apps/web/src/lib/hooks.ts` — `useGasFreePublishTrace()` hook (line 160+)
- `scripts/test-paymaster.ts` — test script that ran the UserOp

---

## Update — Day 11 (May 24)

The blocker persists. The Circle Paymaster contract is still not deployed on the Canteen-hosted Arc testnet RPC.

No code changes attempted. The `useGasFreePublishTrace()` hook exists in `hooks.ts` but is not called from any page or component — it's dormant infrastructure. The `NEXT_PUBLIC_BUNDLER_RPC` env var is set in the root `.env.local` but not in `apps/web/.env.local` or Vercel (it's not needed until the paymaster contract is available).

If the paymaster becomes available on Arc testnet, the wiring steps would be:
1. Add `NEXT_PUBLIC_BUNDLER_RPC` to `apps/web/.env.local` and Vercel
2. Call `useGasFreePublishTrace()` from the trace publish flow
3. Test with a real `publishTrace` UserOp

---

*Same honest framing as the Polymarket archive: code correct, external contract not reachable from this environment. The bundler (Pimlico) side was verified working.*
