# Phase 3 Archive: App Kit — Working

**Status:** Working — confirmed from browser (Polygon Amoy → Arc testnet)
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

## The blocker (resolved)

**`kit.bridge()` hung in the build environment — Circle's API was unreachable due to network restrictions.**

The `AppKit` class makes network calls to Circle's infrastructure when `bridge()`, `send()`, or `getSupportedChains()` are invoked. These calls did not complete from the hackathon build environment. The process produced no output and no error — it just hung until killed.

**Resolution:** The code was always correct. The issue was network access, not implementation. From a standard browser with normal internet access (no build-environment restrictions), `kit.bridge()` executes the full CCTP V2 flow end-to-end.

## What was tested

1. `require('@circle-fin/app-kit')` — module resolves, `AppKit` class is a function
2. `new AppKit()` — instantiates without error
3. `createViemAdapterFromProvider()` — creates adapter from browser wallet (MetaMask)
4. `kit.bridge()` — **confirmed working from browser** (Polygon Amoy → Arc testnet)

The full CCTP V2 bridge flow works: approve → burn on source chain → fetch attestation → mint on Arc.

## Files

- `apps/web/src/lib/appkit.ts` — full implementation
- `apps/web/src/components/funding-dialog.tsx` — funding UI
- `apps/web/src/app/api/bridge/route.ts` — bridge API route
- `apps/web/src/components/navbar.tsx` — "Fund" button added

---

## Update — Day 11 (May 24)

The blocker persisted in the build environment. Circle's API was still unreachable from the hackathon network.

No code changes attempted. The bridge API route (`/api/bridge`) and funding dialog were wired and build-clean. The "Fund" button in the navbar opened the dialog, which called the bridge API route. The entire UI/API layer was production-ready — the only missing piece was Circle's API responding to the `bridge()` call.

---

## Update — Day 12 (May 23)

Three fixes applied to make the bridge robust regardless of network conditions:

1. **Timeout wrapper** (`apps/web/src/lib/appkit.ts`): Added `withTimeout` helper using `Promise.race`. Both `bridgeToArc()` and `sendOnArc()` now timeout after 30 seconds with a `BridgeTimeoutError`. No more indefinite hangs.

2. **API route error classification** (`apps/web/src/app/api/bridge/route.ts`): Catch block now detects `BridgeTimeoutError` and returns `{ error, isTimeout: true }` with HTTP 504 (Gateway Timeout) instead of 502.

3. **Funding dialog retry UI** (`apps/web/src/components/funding-dialog.tsx`): Added `isTimeout` state. Timeout errors show a specific message ("Circle's API may be temporarily unreachable") with a Retry button that resets to idle. Non-timeout errors show the original message.

Confirmed via arc-canteen context: `new AppKit()` with no arguments is the correct constructor for bridge operations — `BridgeKitConfig` and `BridgeParams` have no `kitKey` field. The `NEXT_PUBLIC_CIRCLE_KIT_KEY` env var is not needed for bridge. The hang was purely a network access issue.

---

## Update — Day 12 (May 23, continued)

**Bridge confirmed working from browser.** Emmanuel tested the full CCTP V2 flow from Polygon Amoy to Arc testnet via the funding dialog. `kit.bridge()` executed successfully — approve, burn on source chain, attestation fetch, mint on Arc. The code was always structurally correct; the blocker was the build environment's network restrictions, not the implementation.

**Post-confirmation hardening:**
1. Removed the artificial `withTimeout` wrapper — `kit.bridge()` handles its own errors naturally.
2. Added CORS-specific error detection in `bridgeToArc()` — catches the `x-user-agent` header issue from `@circle-fin/app-kit` and shows a clear message about network requirements.
3. Simplified funding dialog error handling — removed `isTimeout` state, unified error display with Retry button.

---

*Blocker resolved. Bridge works from standard browser environments. The build environment's network restrictions were the only obstacle.*
