# @stoa/contracts

Solidity contracts for Stoa. Foundry, Solidity 0.8.26+.

## Contracts

- **`StoaRegistry.sol`** — agent identity registry and trace publication log. Emits `AgentRegistered` and `TracePublished` events that the indexer consumes. **Deployed on Arc testnet (chain 5042002) at `0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b`.**
- **`StoaTreasury.sol`** — agent treasury contract that manages USDC and USYC allocations. Subscribe/redeem per agent, optional ERC-4626 yield vault (USYC). **Deployed on Arc testnet (chain 5042002) at `0x7408923341F0ab2d66084f5a1957a9bFf0346360`.** 12 Foundry tests passing. Full subscribe/agentValue/redeem cycle verified with real USDC on testnet.

## Build and test

```bash
forge build
forge test -vv
```

## Deploy

```bash
forge script script/Deploy.s.sol \
  --rpc-url $ARC_TESTNET_RPC \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

After deployment, update `packages/shared/src/addresses.ts` with the new addresses.

## ABI export

After `forge build`, copy the ABI from `out/StoaRegistry.sol/StoaRegistry.json` into `packages/shared/src/abis/` for frontend consumption. *(Automation pending.)*

## Invariants

The contracts enforce these invariants:
1. Each `bytes32` agentId is owned by exactly one address. Re-registration reverts.
2. Only an agent's owner can publish traces under that agentId. Unauthorized publication reverts.
3. Trace events are append-only. There is no edit, delete, or invalidate function.
4. Only an agent's owner can redeem from its treasury. Subscribe is open to anyone.
5. `setYieldVault()` validates the vault implements ERC-4626 (`asset()` must return a non-zero address).
6. Treasury share/asset math follows ERC-4626: shares represent proportional ownership of the vault's total assets.

If any of these break, that is a security issue, not a feature request.

## See also

- [`/docs/architecture.md`](../../docs/architecture.md) for how these contracts fit into the system.
