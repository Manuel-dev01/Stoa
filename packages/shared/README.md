# @stoa-agents/shared

Shared types, constants, schemas, and ABIs used across the Stoa monorepo.

## Exports

- `addresses` — deployed contract addresses per network
- `schemas` — Zod schemas (trace JSON, agent config, fee schedules)
- `abis` — TypeScript-typed ABIs auto-exported from Foundry builds
- `constants` — protocol constants (default fee schedules, confidence thresholds, etc.)

## Build

```bash
pnpm --filter @stoa-agents/shared build
```

`apps/web` and `packages/sdk` both depend on this package. Build it first.

## When to add to shared

Add to `@stoa-agents/shared` only when a value or type is needed in two or more workspace packages. Single-consumer values stay local to their package.
