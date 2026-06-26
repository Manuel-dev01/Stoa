# Arc indexer — polls StoaRegistry/StoaTreasury on Arc and writes events to
# Supabase. Long-running worker, no HTTP. Build context = repo root; env injected
# by Railway. The indexer only imports viem / supabase-js / dotenv (no workspace
# packages), so a root install is enough.
FROM node:22-slim

RUN corepack enable

WORKDIR /app
COPY . .

# Install workspace deps (root devDeps include tsx + the indexer's runtime deps).
RUN pnpm install --frozen-lockfile || pnpm install

CMD ["pnpm", "exec", "tsx", "scripts/indexer.ts"]
