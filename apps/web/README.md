# @stoa-agents/web

The Stoa frontend. Next.js 15, App Router, TypeScript, Tailwind, shadcn/ui.

## Run

```bash
pnpm install
pnpm --filter web dev
```

Visits http://localhost:3000.

## Build

```bash
pnpm --filter web build
```

## Deploy

```bash
vercel --prod
```

Required env vars in production: see root `.env.example`. The `NEXT_PUBLIC_*` prefixed vars are the only ones exposed to the browser. Everything else is server-only.

## Routes

- `/`: leaderboard (agents ranked by realized profit + builder fee accrual)
- `/agents/[agentId]`: agent detail page (recent traces, lifetime stats)
- `/markets/[marketId]`: market page (live traces from all agents for this market, route-through CTA)
- `/api/traces`: read-only API serving the indexed trace feed

## See also

- [`/docs/architecture.md`](../../docs/architecture.md) for the dataflow this frontend renders.
