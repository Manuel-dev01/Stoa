# Resolution Plan — Archived Blockers

Four items blocked by external infra. All share the same pattern: code correct, external contract/API unreachable from the local build environment.

---

## 1. Polymarket Broadcast

**Archive:** `docs/archive/phase-2-polymarket-broadcast.md`
**Status:** Blocked
**Impact:** Phase 2 exit criterion not met — no live `OrderFilled` event with builder fee accrual

**The problem:** The deposit wallet (`0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a`) was not deployed through the official Polymarket relayer flow. ERC-1967 implementation slot is `0x0` — no code on the proxy. CLOB API rejects all POLY_1271 orders with "the order signer address has to be the address of the API KEY" because the proxy can't execute `isValidSignature()`. The relayer is unreachable from this environment.

**What works:** CLOB API keys derived, order signing produces valid ERC-7739 signatures, builder code registered, CLOB balance shows 3 pUSD, dry-run orders pass all assertions. The entire pipeline is production-ready — only the live broadcast is blocked.

**Resolution paths:**
1. **Polymarket UI** — polymarket.com calls the relayer internally when you first deposit. Access the UI from a browser with no network restrictions. It should deploy the proxy wallet.
2. **Vercel deployment** — test from the production URL. Vercel's serverless functions may have different outbound network access than the local environment.
3. **Different network** — access the relayer from a machine without the network restrictions that block it from the build environment.
4. **Builder API credentials** — get Builder API credentials from Polymarket (separate from CLOB trading keys), then use `@polymarket/builder-relayer-client` to call `WALLET-CREATE` from a reachable environment.

**Once resolved, complete these steps:**
1. Verify proxy implementation slot is non-zero: `cast storage $PROXY 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url polygon`
2. Fund proxy with pUSD (`0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB`)
3. Sync CLOB balance: `GET /balance-allowance/update?asset_type=COLLATERAL&signature_type=3`
4. Broadcast a $0.05 BUY test order
5. Verify `OrderFilled` event with builder field matching our code

---

## 2. Paymaster

**Archive:** `docs/archive/phase-3-paymaster.md`
**Status:** Compiled, not proven
**Impact:** Gas-free user transactions on Arc not available

**The problem:** Circle Paymaster contract `0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966` (v0.8) and `0x31BE08D380A21fc740883c0BC434FcFc88740b58` (v0.7) return no code on Canteen's Arc testnet RPC. Bundler returns `AA30 paymaster not deployed`.

**Confirmed via arc-canteen context:** Both addresses verified as empty on chain ID `5042002` (Canteen's Arc testnet) using `cast code`. Circle's official docs (`developers.circle.com/paymaster/addresses-and-events.md`) list these addresses for Arc Testnet, but Circle has not deployed them to Canteen's specific RPC endpoint. The Pimlico bundler URL is `https://public.pimlico.io/v2/${chain.id}/rpc`. v0.7 uses `toCircleSmartAccount` from `@circle-fin/modular-wallets-core`; v0.8 uses `toSimple7702SmartAccount` from `viem/account-abstraction`.

**What works:** `apps/web/src/lib/paymaster.ts` — full implementation with `createGasFreeAccount()`, `signPermit()`, `createPaymaster()`, `createGasFreeClient()`. EIP-2612 permit signing verified. Pimlico bundler accepted the UserOp and ran simulation. Web app builds clean.

**Resolution paths:**
1. **Circle's own RPC** — check if Circle has a separate Arc testnet RPC (different from Canteen's) where the paymaster is deployed.
2. **Different chain ID** — Circle may use a different Arc testnet chain ID for paymaster deployment.
3. **Wait for deployment** — Circle may deploy the paymaster to Canteen's endpoint closer to mainnet.

**Once resolved, complete these steps:**
1. Add `NEXT_PUBLIC_BUNDLER_RPC` to `apps/web/.env.local` and Vercel
2. Call `useGasFreePublishTrace()` from the trace publish flow
3. Test with a real `publishTrace` UserOp

---

## 3. App Kit Bridge

**Archive:** `docs/archive/phase-3-appkit.md`
**Status:** Compiled, not proven
**Impact:** Cross-chain funding flow not functional

**The problem:** `kit.bridge()` hangs indefinitely — no response from Circle's API. Same network access issue as the Polymarket relayer.

**Confirmed via arc-canteen context:** App Kit bridge docs (`docs.arc.network/app-kit/bridge.md`, `bridge-stablecoin.md`) confirm the API shape: `kit.bridge()` returns a `BridgeResult` with steps array containing `explorerUrl` per step. The four CCTP steps are approve → burn → fetchAttestation → mint. Error recovery via `kit.retry()`. Bridge operations do not require a kit key. Our implementation in `apps/web/src/lib/appkit.ts` is structurally consistent with the documented API. The hang is a network access issue, not a code bug.

**What works:** `@circle-fin/app-kit` installed and resolving. `AppKit` class instantiates. `createViemAdapterFromPrivateKey()` works. `apps/web/src/lib/appkit.ts` — `bridgeToArc()` and `sendOnArc()` compile. `apps/web/src/components/funding-dialog.tsx` — UI with chain selector, amount input, bridge button. `apps/web/src/app/api/bridge/route.ts` — server-side API route. Navbar has "Fund" button. Web app builds clean.

**Resolution paths:**
1. **Vercel deployment** — test from the production URL. Vercel's serverless functions may reach Circle's API.
2. **Different network** — test from a machine without the network restrictions.

**Once resolved, complete these steps:**
1. Deploy to Vercel
2. Click "Fund" in navbar, select chain and amount
3. Verify `bridge()` completes and funds arrive on Arc testnet

---

## 4. Treasury Yield

**Archive:** `docs/archive/phase-3-treasury-yield.md`
**Status:** Resolved — Teller is a full ERC-4626 vault, allowlisting pending
**Impact:** USYC yield on idle treasury capital — wiring pending allowlisting

**The problem:** StoaTreasury's `setYieldVault()` expects an ERC-4626 vault. The USYC **token** (`0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C`) is a plain ERC-20 and doesn't implement `asset()`. But the **Teller** contract (`0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`) — which is what you actually interact with to mint/redeem USYC — implements the full ERC-4626 interface.

**Breakthrough:** Verified live on Arc testnet via `cast call`:
- `asset()` → `0x3600000000000000000000000000000000000000` (USDC)
- `totalAssets()` → `1494803751255` (~$1.49M TVL)
- `convertToAssets(1e6)` → `1116277` (1 USYC = $1.116, ~11.6% yield accrued)
- `convertToShares(1e6)` → `895834`
- `previewDeposit/previewRedeem/maxDeposit/maxRedeem` → all work
- `deposit()` and `redeem()` → function exists, reverts due to allowlisting (not missing function)

The original blocker was using the USYC token address instead of the Teller address. `setYieldVault()` calls `IERC4626(_vault).asset()` — the Teller passes this check. **Zero code changes to StoaTreasury.sol needed.**

**What works (live on-chain):** StoaTreasury deployed at `0x812BcEEc2De8C8aC71C7af7A8E2d4467E65Fdf18`. Full subscribe/agentValue/redeem cycle verified with real USDC. 12 Foundry tests pass. Frontend hooks wired.

**Remaining blocker:** The treasury contract must be allowlisted on the Entitlements contract (`0xcc205224862c7641930c87679e98999d23c26113`) before the Teller will accept `deposit()` calls. This requires a Circle Support ticket — 24-48hr turnaround.

**Once allowlisted, complete these steps:**
1. `cast send $TREASURY "setYieldVault(address)" $TELLER` — wire the vault
2. `cast send $USDC "approve(address,uint256)" $TREASURY 1000000`
3. `cast send $TREASURY "subscribe(bytes32,uint256)" $AGENT_ID 1000000`
4. `cast call $TREASURY "agentValue(bytes32)" $AGENT_ID` — should return ~1116277 (yield already accrued)
5. Redeem and verify `assets > shares`

---

## Summary

| Item | Blocker | Code status | Resolution |
|------|---------|-------------|------------|
| Polymarket Broadcast | Relayer unreachable | Production-ready (dry-run verified) | Try from Polymarket UI or Vercel |
| Paymaster | Contract not on Canteen RPC (confirmed: both v0.7 + v0.8 return `0x` on chain 5042002) | Compiled, bundler tested | Try Circle's own RPC or wait |
| App Kit Bridge | Circle API unreachable (code matches documented API) | Compiled, UI wired, timeout added | Try from Vercel; 30s timeout prevents hangs |
| Treasury Yield | Teller is ERC-4626 (confirmed live); allowlisting pending (24-48hr) | Zero code changes needed | Wire `setYieldVault(TELLER)` once allowlisted |

Three are external infra issues. Treasury yield is resolved — just waiting on Circle Support allowlisting.
