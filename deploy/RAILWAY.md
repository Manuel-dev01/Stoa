# Railway deploy — Triad daemon + Arc indexer

Moves the two long-running local processes off the laptop. The web app + x402
tollbooth stays on Vercel. Both Railway services are workers (no public HTTP):
the daemon loops on `TRIAD_CYCLE_INTERVAL`, the indexer polls Arc.

## One-time setup (per service)

Create **two** services in one Railway project, both pointing at this repo:

| Service | Config file (Settings → Config-as-code path) | Builds from |
|---|---|---|
| `triad-daemon` | `deploy/railway-daemon.json` | `deploy/daemon.Dockerfile` |
| `indexer` | `deploy/railway-indexer.json` | `deploy/indexer.Dockerfile` |

Both Dockerfiles use the **repo root** as build context — leave each service's
Root Directory at the repo root (do not set it to a subdir).

## CLI path (if `railway` is installed + logged in)

```bash
npm i -g @railway/cli
railway login
railway init                 # or: railway link  (pick the project)
# Service 1
railway service create triad-daemon
railway up --service triad-daemon -c deploy/railway-daemon.json
# Service 2
railway service create indexer
railway up --service indexer -c deploy/railway-indexer.json
```

(If `railway` isn't authenticated in this environment, use the dashboard: New
Service → Deploy from repo → set the config-as-code path above.)

## Environment variables (set on BOTH services unless noted)

Railway injects these into the process env; pydantic-settings / dotenv read them
directly, so no `.env.local` is shipped. Copy values from `apps/agent/.env.local`
(daemon) and the root `.env.local` / `.env.example` (indexer).

**triad-daemon:**
```
DEEPSEEK_API_KEY
2_LLM_MODEL  2_LLM_API_KEY  2_LLM_BASE_URL        # Groq → Quantec
3_LLM_MODEL  3_LLM_API_KEY  3_LLM_BASE_URL        # Gemini → Bayesian + embeddings
FRED_API_KEY
IRYS_PRIVATE_KEY  IRYS_NODE_URL  IRYS_TOKEN  IRYS_PROVIDER_URL
ARC_TESTNET_RPC
STOA_REGISTRY_ADDRESS
CIRCLE_API_KEY  CIRCLE_ENTITY_SECRET  CIRCLE_WALLET_SET_ID  CIRCLE_WALLET_ID  USE_CIRCLE_WALLETS=true
SUPABASE_URL  SUPABASE_SERVICE_ROLE_KEY
TRIAD_TOP_N=10            # optional
TRIAD_CYCLE_INTERVAL=600  # optional (seconds)
```

**indexer:**
```
SUPABASE_URL  SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_ARC_RPC            (or ARC_TESTNET_RPC)
NEXT_PUBLIC_STOA_REGISTRY_ADDRESS
NEXT_PUBLIC_STOA_TREASURY_ADDRESS   # optional (treasury events)
INDEXER_START_BLOCK  INDEXER_POLL_INTERVAL_MS=5000
```

## Verify after deploy

- `triad-daemon` logs: `triad models: quantec=… bayesian=… calibrator=…` and a
  per-market `Arc: 0x… rating=… kelly=…`, then `Cycle N done: K feed items published`.
- `indexer` logs: `TracePublished: …` rows written to Supabase.
- Query Supabase `feed_items` — new rows appear each cycle with nothing running locally.

## Note: x402 tollbooth env (Vercel, not Railway)

The feed gate runs in the Next.js app on Vercel. Set there:
`STOA_TREASURY_ADDRESS` (=`0xdf642780530469ec2ab93b543af688eea92e3bb7`),
`ARC_USDC_ADDRESS` (=`0x3600000000000000000000000000000000000000`),
`ARC_RPC_URL`, `X402_TOLL_USDC=0.005`, `X402_USDC_DECIMALS=6`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — via `vercel env add` or the dashboard.
