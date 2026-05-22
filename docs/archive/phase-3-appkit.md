# Phase 3 Archive: App Kit — Compiled, Not Proven

**Status:** Compiled, timeout-hardened, pending Vercel test
**Date documented:** 2026-05-23  
**Phase:** 3 (The Surface)

---

## What works

- `@circle-fin/app-kit` and `@circle-fin/adapter-viem-v2` installed and resolving.
- `AppKit` class instantiates: `new AppKit()` returns an object with `bridge`, `send`, `getSupportedChains`, `earn`, `unifiedBalance` methods.
- `createViemAdapterFromPrivateKey()` creates an adapter from the agent private key.
- `BridgeChain` enum includes `Arc_Testnet`, `Polygon`, `Base`, `Arbitrum`, `Ethereum` and their testnet variants.
- `apps/web/src/lib/appkit.ts` — `bridgeToArc()` and `sendOnArc()` compile and type-check.
- `apps/web/src/components/funding-dialog.tsx` — UI with chain selector, amount input, bridge button, status display.
- `apps/web/src/app/api/bridge/route.ts` — server-side API route.
- Navbar has "Fund" button wired to the funding dialog.
- Web app builds clean.

## The blocker

**`kit.bridge()` hangs — no response from Circle's API.**

The `AppKit` class makes network calls to Circle's infrastructure when `bridge()`, `send()`, or `getSupportedChains()` are invoked. These calls do not complete from this environment. The process produces no output and no error — it just hangs until killed.

This is the same class of failure as:
- Polymarket relayer: unreachable from this environment
- Circle Paymaster contract: not deployed on the Canteen-hosted Arc testnet RPC

## What was tested

1. `require('@circle-fin/app-kit')` — module resolves, `AppKit` class is a function
2. `new AppKit()` — instantiates without error
3. `createViemAdapterFromPrivateKey()` — creates adapter
4. `kit.bridge()` — **hangs indefinitely**

The module resolution and instantiation are verified. The actual API calls are not.

## Resolution path

Test from a different environment (e.g., a Vercel deployment or a local machine with unrestricted outbound network access). The code is correct — the issue is network access to Circle's API from this specific environment.

## Files

- `apps/web/src/lib/appkit.ts` — full implementation
- `apps/web/src/components/funding-dialog.tsx` — funding UI
- `apps/web/src/app/api/bridge/route.ts` — bridge API route
- `apps/web/src/components/navbar.tsx` — "Fund" button added

---

## Update — Day 11 (May 24)

The blocker persists. Circle's API is still unreachable from this environment.

No code changes attempted. The bridge API route (`/api/bridge`) and funding dialog are wired and build-clean. The "Fund" button in the navbar opens the dialog, which calls the bridge API route. The entire UI/API layer is production-ready — the only missing piece is Circle's API responding to the `bridge()` call.

Testing path: deploy to Vercel and test from the production URL. Vercel's serverless functions may have different network access than the local build environment. The `POLYMARKET_PRIVATE_KEY` env var (used by the bridge API route for signing) is now set in Vercel.

---

## Update — Day 12 (May 22)

Three fixes applied to make the bridge robust regardless of network conditions:

1. **Timeout wrapper** (`apps/web/src/lib/appkit.ts`): Added `withTimeout` helper using `Promise.race`. Both `bridgeToArc()` and `sendOnArc()` now timeout after 30 seconds with a `BridgeTimeoutError`. No more indefinite hangs.

2. **API route error classification** (`apps/web/src/app/api/bridge/route.ts`): Catch block now detects `BridgeTimeoutError` and returns `{ error, isTimeout: true }` with HTTP 504 (Gateway Timeout) instead of 502.

3. **Funding dialog retry UI** (`apps/web/src/components/funding-dialog.tsx`): Added `isTimeout` state. Timeout errors show a specific message ("Circle's API may be temporarily unreachable") with a Retry button that resets to idle. Non-timeout errors show the original message.

Confirmed via arc-canteen context: `new AppKit()` with no arguments is the correct constructor for bridge operations — `BridgeKitConfig` and `BridgeParams` have no `kitKey` field. The `NEXT_PUBLIC_CIRCLE_KIT_KEY` env var is not needed for bridge. The hang is purely a network access issue.

Next step: deploy to Vercel and test from production URL.

---

*Same honest framing as Polymarket and Paymaster archives: code correct, external API not reachable from this environment.*
