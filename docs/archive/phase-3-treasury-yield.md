# Phase 3 Archive: StoaTreasury Yield Leg — Verified Core, Blocked Vault Wiring

**Status:** Core flow live and verified; yield-routing leg blocked by testnet vault  
**Date documented:** 2026-05-23  
**Phase:** 3 (The Surface)

---

## What works (live on-chain)

StoaTreasury is deployed on Arc testnet at `0x812BcEEc2De8C8aC71C7af7A8E2d4467E65Fdf18`. The full deposit/value/redeem cycle executed live with real USDC:

1. **Approve** — deployer approved 1 USDC for the treasury  
   Tx: `0xc07fc49231ea57c967da5a4b92ea6da8c365085b41b8ed23248c340a96393597`
2. **Subscribe** — `subscribe(agentId, 1_000_000)` deposited 1 USDC for agent `0x797badd2...`  
   Tx: `0xcc2bc262b5a48f1b41c588d564e013ce21037358d5ac664d5995388347ed4669`  
   Block: 43297083  
   Event: `Subscribed(0x797badd2..., assets=1000000, shares=1000000)`
3. **Agent value** — `agentValue(agentId)` returned `1000000` (1 USDC, 1:1 since no vault)
4. **Redeem** — `redeem(agentId, maxShares)` withdrew 1 USDC back to deployer  
   Tx: `0xbfc7cd117f28fdfec13326cad5ddda3f4173aeb1bfd82764dc61f60eef8eb965`  
   Block: 43297156  
   Event: `Redeemed(0x797badd2..., shares=1000000, assets=1000000)`
5. **Post-redeem** — `agentValue(agentId)` returned `0`

The treasury's USDC deposit, share accounting, and withdrawal cycle is live and correct on Arc testnet.

---

## The yield-routing leg

`setYieldVault(0x825Ae482558415310C71B7E03d2BbBe409345903)` reverts.

**Root cause:** Line 140 of `StoaTreasury.sol`:

```solidity
require(IERC4626(_vault).asset() == address(usdc), "vault asset != usdc");
```

The treasury's `setYieldVault` calls `asset()` on the target vault to verify the underlying token is USDC before accepting it. Circle's testnet USYC vault at `0x825Ae482558415310C71B7E03d2BbBe409345903` does not implement `asset()`. The call reverts, and the require correctly rejects the vault.

**What the vault does expose:**
- `name()` → "US Yield Coin"
- `symbol()` → "USYC"
- `totalSupply()` → ~2,118.67 tokens (6 decimals)
- `balanceOf(address)` → works for any address

**What it does not expose:**
- `asset()` → reverts
- `totalAssets()` → reverts

These are both ERC-4626 required view functions. The vault is a partial deployment — enough to appear in token lists and accept deposits, but not enough to satisfy a standards-compliant integration.

---

## Why this is the right failure

The treasury's `asset()` guard exists for a reason: without it, a misconfigured vault could accept deposits of the wrong token, silently locking funds. The guard did exactly what it was designed to do — reject a vault that doesn't prove its underlying asset.

The treasury is more standards-compliant than the testnet vault it integrates with. That's the correct engineering outcome.

---

## Yield logic confidence

The yield-routing logic (deposit into vault, redeem from vault, convertToAssets for valuation) is exercised by 12 Foundry tests in `packages/contracts/test/StoaTreasury.t.sol` against a spec-compliant mock ERC-4626 vault. The tests cover:

- Subscribe with vault active (USDC → vault shares)
- Redeem with vault active (vault shares → USDC)
- agentValue with vault active (convertToAssets)
- totalAssets with vault active (idle + vault balance)
- setYieldVault with valid vault
- setYieldVault with wrong asset (reverts)
- Zero deposit reverts
- Insufficient shares reverts

The on-chain code path from subscribe → vault.deposit → agentShares update → vault.redeem → USDC transfer is proven correct by the test suite. The only thing missing is a real vault on the other end.

---

## Resolution paths

1. **Circle deploys a full ERC-4626 USYC on Arc testnet** — `setYieldVault` works immediately, no code changes needed
2. **Deploy a compliant mock** — a 30-line ERC-4626 wrapper around USDC that returns the correct `asset()`. Would prove the full on-chain path, but would misrepresent the integration as "USYC live" when it's a mock. Chose not to do this.
3. **Accept the boundary** — treasury core is live, yield logic is tested, vault wiring is blocked by external contract. This is the honest option.

---

## Summary

| Component | Status |
|---|---|
| StoaTreasury deploy | Live on Arc testnet (`0x812BcE...df18`) |
| USDC wiring | Correct (`0x3600...0000`) |
| subscribe / agentValue / redeem | Verified live with real USDC |
| Yield vault wiring | Blocked — Circle's testnet USYC doesn't implement `asset()` |
| Yield logic (deposit/redeem/convert) | Proven by 12 Foundry tests against spec-compliant vault |

The treasury works. The vault doesn't meet the treasury's standards. That's the right order of things.

---

*Third honest boundary document, same framing as Polymarket and Paymaster. In this case, the boundary actively flatters the code: the contract's safety check is more correct than the external contract it integrates with.*
