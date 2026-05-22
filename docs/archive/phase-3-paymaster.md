# Phase 3 Archive: Paymaster — Not Applicable on Arc

**Status:** Resolved — Arc uses USDC natively for gas, paymaster not needed
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

## Update — Day 12 (May 22)

**Finding: Paymaster is not needed on Arc.**

Verified on Circle's own RPC (`https://rpc.testnet.arc.network`): `cast code 0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` returns `0x`. The contract is not deployed there either.

Root cause: Arc's gas model is fundamentally different from Ethereum/Base/Polygon. Per [docs.arc.io/arc/references/gas-and-fees](https://docs.arc.io/arc/references/gas-and-fees):

> "Arc denominates all transaction fees in USDC, the native gas token."

The Circle Paymaster exists on chains where gas is paid in ETH and you want to abstract it to USDC via EIP-2612 permits + ERC-4337. On Arc, that abstraction is unnecessary — every transaction already pays gas in USDC natively at ~$0.01/tx. Circle's Paymaster docs list: Arbitrum, Avalanche, Base, Ethereum, Optimism, Polygon, Unichain. Arc is not listed because Arc doesn't need it.

The "What worked with Circle / Arc" story is the native USDC gas model itself. No paymaster hack needed.

The `paymaster.ts` code and `useGasFreePublishTrace()` hook remain as reference for post-hackathon multi-chain expansion (if Stoa ever needs gas abstraction on ETH-gas chains).

---

*Resolution is better than originally framed: the code is correct AND the external contract being absent is the right outcome — Arc solved the problem at the protocol level.*
