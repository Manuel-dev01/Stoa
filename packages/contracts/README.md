# @stoa/contracts

Solidity contracts for Stoa. Foundry, Solidity 0.8.26+.

## Contracts

- **`StoaRegistry.sol`** — agent identity registry and trace publication log. Emits `TracePublished` events that the indexer consumes.
- **`StoaTreasury.sol`** — agent treasury contract that manages USDC and USYC allocations.

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

Contract ABIs are auto-exported to `packages/shared/src/abis/` by the `forge build` hook. Frontend imports them from `@stoa/shared`.

## Invariants

The contracts enforce three invariants:
1. Each `bytes32` agentId is owned by exactly one address. Re-registration reverts.
2. Only an agent's owner can publish traces under that agentId. Unauthorized publication reverts.
3. Trace events are append-only. There is no edit, delete, or invalidate function.

If any of these break, that is a security issue, not a feature request.

## See also

- [`/docs/architecture.md`](../../docs/architecture.md) for how these contracts fit into the system.
