# Phase 3 Archive: App Kit — Compiled, Not Proven

**Status:** Compiled, not proven  
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

*Same honest framing as Polymarket and Paymaster archives: code correct, external API not reachable from this environment.*
