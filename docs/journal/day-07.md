# Day 7 — May 23

## Shipped

### USYC Treasury Integration

StoaTreasury is live on Arc testnet. The contract manages USDC deposits per agent, with an optional ERC-4626 yield vault (USYC) for idle capital.

**Contract:** `0xe8eB3a0233D8E227636f91f45Cd17583Be6A1008` on Arc testnet (chain ID 5042002)

**What it does:**
- Agents (or their followers) deposit USDC via `subscribe(agentId, amount)`. The treasury holds it.
- If a yield vault is set, USDC is forwarded into the ERC-4626 vault (USYC) automatically. The agent's shares represent vault shares, not raw USDC.
- `redeem(agentId, shares)` burns shares and returns USDC. Pass `type(uint256).max` to redeem everything.
- `agentValue(agentId)` returns the current USDC value of an agent's position — vault yield included.
- `totalAssets()` returns all USDC under management (idle balance + vault balance).

**Why USYC:**
An agent's treasury sits idle between trades. USYC's instant-redemption tier means an agent can earn ~3.2% net APY on cash while keeping liquidity for the next trade. We considered Aave aUSDC and Mountain USDM; USYC's redemption mechanics are the cleanest fit for short-cycle agentic capital, and the integration is a recognized Circle primitive.

**Design decisions:**
- No OpenZeppelin dependency. Raw ERC-20 and ERC-4626 calls. The contract is 150 lines, self-contained, and auditable in one read.
- Shares are per-agent (`mapping(bytes32 => uint256)`). When no vault is set, shares are 1:1 with USDC (6 decimals). When a vault is set, shares track the vault's exchange rate.
- `setYieldVault(address)` is owner-only and validates that the vault's underlying asset matches the treasury's USDC. Can be set to `address(0)` to disable yield.
- No proxy pattern. No upgradability. If we win the hackathon, we redeploy with proper upgradability for mainnet.

**Test coverage (12 Foundry tests):**
- Subscribe deposits USDC, reverts on zero amount
- Redeem returns USDC, reverts on insufficient shares
- Max-redeem (`type(uint256).max`) redeems all shares
- Vault integration: subscribe/redeem with ERC-4626 mock (1:1 exchange rate)
- `agentValue` returns correct USDC value with and without vault
- `setYieldVault` reverts if caller is not owner
- `setYieldVault` reverts if vault asset does not match USDC
- Ownership transfer works

**Frontend integration:**
- `useTreasuryValue(agentId)` — reads `agentValue` on-chain via `useReadContract`
- `useTreasuryShares(agentId)` — reads `agentShares`
- `useTreasurySubscribe()` — wraps `subscribe` via `useWriteContract`
- `useTreasuryRedeem()` — wraps `redeem` via `useWriteContract`
- Agent detail pages show treasury value as a 4th stat card: `$${(Number(treasuryValue) / 1e6).toFixed(2)}`
- ABI: `apps/web/src/lib/shared/stoaTreasury.ts`
- Hooks: `apps/web/src/lib/hooks.ts`

**Files changed:**
- `packages/contracts/src/StoaTreasury.sol` — full implementation
- `packages/contracts/test/StoaTreasury.t.sol` — 12 tests
- `packages/contracts/script/DeployTreasury.s.sol` — deploy script
- `packages/shared/src/addresses.ts` — treasury address added
- `apps/web/src/lib/shared/stoaTreasury.ts` — ABI export
- `apps/web/src/lib/hooks.ts` — treasury hooks
- `apps/web/src/app/agents/[agentId]/page.tsx` — treasury stat card

### Open item: USDC address on Arc testnet

The treasury is deployed with `address(0)` for USDC. The real USDC address on Arc testnet needs to be confirmed from Circle/Hashnote docs, then the contract owner calls `setYieldVault()` with the USYC vault address once USDC is live on Arc. Until then, the treasury operates in 1:1 mode (no yield).

---

## Blocked on

- **Polymarket deposit wallet**: still requires `WALLET-CREATE` via relayer + `POLY_1271` signature type. Relayer API not reachable from our environment. Options: try from a different network, or manually create deposit wallet via Polymarket UI.
- **USDC/USYC on Arc testnet**: need confirmed addresses from Circle docs before enabling yield.

---

## Next session goal

- Resolve Polymarket deposit wallet (try from different network, or use Polymarket UI to create deposit wallet manually)
- OR continue with Phase 3 items: Paymaster integration, App Kit components, SDK extraction
- Confirm USDC address on Arc testnet and set yield vault
