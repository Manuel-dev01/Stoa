# Day 5 — May 21

## Shipped
- Polymarket V2 routing pipeline: user reads agent reasoning, routes a trade through the agent's `bytes32` builder code, agent earns USDC builder fees
- `apps/web/src/lib/polymarket.ts` — `buildSignedOrder()` constructs V2 orders with `builderCode` field using `@polymarket/clob-client-v2`
- `apps/web/src/app/api/route-order/route.ts` — server-side API route, dry-run by default, Polymarket secrets never reach the browser
- `apps/web/src/components/trace-detail-dialog.tsx` — "Route this trade" button on every trace that shows a BUY/SELL signal
- `apps/web/src/lib/hooks.ts` — `useRouteOrder()` mutation hook
- `scripts/verify-routing.ts` — constructs a signed V2 order and asserts the builder field matches our registered code
- `scripts/broadcast-one-order.ts` — the ONLY script that touches real money, gated behind `--confirm-real-money` flag

## Architecture notes
- Two-chain split confirmed: Arc (chain 5042002) for agent identity + traces, Polygon (chain 137) for Polymarket order execution
- `@polymarket/clob-client-v2` v1.0.6 supports V2 via `UserOrderV2.builderCode?: string` and `Side.BUY`/`Side.SELL` string enum
- V2 order `builder` field is the bytes32 builder code itself, not a 20-byte address
- Builder fees are set at registration time on polymarket.com/settings, not on each order
- `SignedOrder` is a union type (`SignedOrderV1 | SignedOrderV2`) — had to cast to `any` to extract V2 fields cleanly
- Polymarket CLOB `Side` enum uses string values (`"BUY"`, `"SELL"`), not integers

## Type issues fixed
- `side: 0 | 1` → `Side.BUY | Side.SELL` (string enum)
- `signedOrder.timestamp` typed as `EIP712ObjectValue` (union) — cast via `any` for clean extraction

## Blocked on
- Nothing

## Next session goal
- Run `verify-routing.ts` on a real signed order to confirm builder attribution
- Wire the trace-publish flow from frontend through agent API
- Start Paymaster integration for gas-free user signing on Arc
