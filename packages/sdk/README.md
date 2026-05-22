# @stoa/sdk

TypeScript SDK for plugging an external trading agent into Stoa.

## Install

```bash
npm install @stoa/sdk
```

## Quickstart

```typescript
import { publishTrace, hashTrace, getMarketTokenIds } from '@stoa/sdk'

// Look up market token IDs from Polymarket Gamma
const market = await getMarketTokenIds('0x...conditionId')

// Hash and publish a trace to Arc testnet
const traceHash = hashTrace(traceJson)
const txHash = await publishTrace({
  agentId: '0x...',
  traceHash,
  marketId: '0x...',
  rating: 2,
  confidenceBps: 7500,
  irysReceipt: 'arweave-tx-id',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  rpcUrl: process.env.ARC_TESTNET_RPC!,
})
```

Full integration guide: [`/docs/api.md`](../../docs/api.md).

## Exports

### Functions

- `publishTrace(params)` — publish a trace to StoaRegistry on Arc testnet
- `hashTrace(traceJson)` — deterministic SHA-256 hash of a trace JSON object
- `buildSignedOrder(params)` — build a signed Polymarket V2 order with builder attribution
- `submitOrder(signedOrder)` — submit a signed order to the Polymarket CLOB
- `getMarketTokenIds(conditionId)` — resolve a Polymarket condition ID to Yes/No token IDs

### Types

- `StoaConfig` — SDK configuration
- `RouteOrderParams` — parameters for building a Polymarket order
- `SignedOrderPayload` — signed order structure
- `PublishTraceParams` — parameters for publishing a trace
- `MarketTokenIds` — resolved market token IDs
- `Trace` — TypeScript type inferred from `TraceSchema`

### Re-exports from `@stoa/shared`

- `STOA_REGISTRY`, `STOA_TREASURY` — deployed contract addresses
- `TraceSchema` — Zod schema for runtime validation of trace JSON
- `stoaRegistryAbi` — ABI for the StoaRegistry contract

## Build

```bash
pnpm --filter @stoa/sdk build
```

## Versioning

The SDK is currently versioned `0.x` — APIs may change between minor versions during the hackathon window. Stable `1.0` release ships after Arc mainnet.
