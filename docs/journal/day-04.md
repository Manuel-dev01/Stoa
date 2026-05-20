# Day 4 — May 20, 2026

**Phase:** 2 of 4 (The Routing)

## What shipped

### Bug fixes (from AM session)

- Gamma API `condition_id` filter: fetches up to 500 markets, filters client-side
- DeepSeek timeout: `OPENAI_API_KEY` → `DEEPSEEK_API_KEY` in all entry points
- Recursion limit: `max_recur_limit` 50 → 100
- Integrity assertion: `MarketIdMismatchError` after `get_market()`
- Block explorer URL: replaced dead `arc-explorer.thecanteenapp.com` with `testnet.arcscan.app`
- Verification one-liner added to README

### Polymarket CLOB key derivation

Created `scripts/setup-clob-keys.ts` — derives CLOB API credentials (key, secret, passphrase) from `POLYMARKET_PRIVATE_KEY` using `@polymarket/clob-client-v2`. All three credentials saved to `.env.local`.

### Frontend (Phase 2 start)

Full Next.js 15 frontend deployed to Vercel:

- **Landing page** (`/`): Leaderboard aggregating traces by agent, live trace stream (newest first), footer with GitHub/Thesis/Discord links
- **Agent detail page** (`/agents/[agentId]`): full agent ID with copy, owner address linked to Arc explorer, 3 stat cards (trace count, avg confidence, latest), all traces in reverse chronological order
- **Trace detail dialog**: shadcn Dialog showing full reasoning from Irys (bull/bear/synthesis), model metadata, links to Irys and Arc explorer
- **Navbar**: "Stoa" brand link + RainbowKit ConnectButton (MetaMask, WalletConnect, injected)
- **Wallet integration**: Wagmi v2 + RainbowKit with Arc testnet (chain ID 5042002, USDC native)
- **Data fetching**: TanStack Query v5 — traces refetch every 30s, Irys bodies cached forever, market data from Gamma API (5min stale)
- **UI components**: 6 shadcn-style components (button, card, dialog, table, badge, skeleton)
- **Dark theme**: indigo accent, shadcn CSS variables

## Deployment

**Vercel URL:** https://web-manuel-dev01s-projects.vercel.app

### What broke on Vercel (3 issues)

1. **`tsconfig.base.json` extends from monorepo root** — Vercel's isolated build can't resolve `../../tsconfig.base.json`. Fixed by inlining all compiler options into `apps/web/tsconfig.json`.

2. **`pnpm --filter @stoa/shared build` in build script** — Vercel uses npm, not pnpm. Fixed by changing build script to just `next build`.

3. **`@stoa/shared/*` path mapping** — cross-package path aliases don't resolve on Vercel. Fixed by copying shared files (addresses, ABI) into `apps/web/src/lib/shared/` and updating imports.

### What broke after first deploy (2 issues)

4. **SSO Deployment Protection** — new Vercel projects default to `ssoProtection.deploymentType: "all_except_custom_domains"`, returning 401 for all requests. Disabled via Vercel API (`ssoProtection: null`).

5. **Empty env var values** — `vercel env add` via piped stdin stripped the values. Re-added all 4 `NEXT_PUBLIC_*` vars via Vercel API with correct values.

## On-chain receipts

No new traces this session. Existing 4 traces from Day 3/4 AM verified on `testnet.arcscan.app`.

## What's next

- Wire the trace-publish flow: frontend calls agent API → agent publishes to Irys + Arc → leaderboard updates
- Connect wallet flow: user connects wallet → sees their agent's traces → can route Polymarket orders
- Paymaster integration for gas-free signing on Arc
- App Kit Send/Bridge components for user funding

## Receipts

- Vercel deployment: https://web-manuel-dev01s-projects.vercel.app
- Vercel inspect: https://vercel.com/manuel-dev01s-projects/web/3Do6brr4upTRJHGPbWyqrkfjNFTd
- Branch: `master`
