# Day 12 — May 22

## Three archived blockers resolved

### Part 1 — Treasury yield breakthrough

Discovered that the USYC **Teller** contract (`0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`) implements the full ERC-4626 interface. Verified live on Arc testnet:

- `asset()` → `0x3600000000000000000000000000000000000000` (USDC)
- `totalAssets()` → `1494803751255` (~$1.49M TVL)
- `convertToAssets(1e6)` → `1116277` (1 USYC = $1.116, ~11.6% yield accrued)
- `convertToShares(1e6)` → `895834`
- `previewDeposit`/`previewRedeem`/`maxDeposit`/`maxRedeem` → all work
- `deposit()` and `redeem()` → function exists, reverts due to allowlisting (not missing function)

The original blocker was testing against the USYC token address (`0xe918...`) instead of the Teller. `setYieldVault()` requires zero code changes — just point it at the Teller.

`packages/shared/src/addresses.ts` updated with `ARC_USYC_TELLER`. USYC Hackathon Access Form submitted for allowlisting the treasury contract on the Entitlements contract. Email drafted to customer-support@circle.com.

### Part 2 — Bridge timeout hardening

Three fixes to `apps/web`:

1. `appkit.ts` — `withTimeout` helper wraps `kit.bridge()` and `kit.send()` in 30s `Promise.race` with `BridgeTimeoutError`.
2. `route.ts` — catch block detects timeout, returns `{ isTimeout: true }` with HTTP 504.
3. `funding-dialog.tsx` — timeout-specific error message with Retry button.

Confirmed via arc-canteen context: `new AppKit()` with no args is correct for bridge (no kitKey needed). Bridge hang is network-level, not code.

### Part 3 — Docs updated

- `docs/resolution.md` — Treasury Yield status changed to "Resolved: Teller is ERC-4626, allowlisting pending."
- `docs/architecture.md` — USYC section updated with Teller details.
- `docs/api.md` — added `ARC_USYC_TELLER` address.
- Archives updated: `phase-3-treasury-yield.md` and `phase-3-appkit.md` both have Day 12 updates.

### Part 4 — Paymaster resolved as not applicable

Verified on Circle's own RPC (`https://rpc.testnet.arc.network`): paymaster contract `0x3BA9...` returns `0x`. Arc denominates all gas in USDC natively — the Circle Paymaster exists for ETH-gas chains (Arbitrum, Base, Polygon, etc.) where you want to abstract gas to USDC via EIP-2612 permits + ERC-4337.

On Arc, every transaction already pays ~$0.01 in USDC. No paymaster needed. The `paymaster.ts` code and `useGasFreePublishTrace()` hook remain as reference for post-hackathon multi-chain expansion.

Updated `docs/resolution.md` and `docs/archive/phase-3-paymaster.md`.
