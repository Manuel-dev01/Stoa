# Triad daemon — runs the three-engine Triad over the top macro/crypto markets,
# anchors each synthesis on Irys + Arc, and writes the feed_items the x402 feed
# serves. Long-running worker (internal sleep loop), no HTTP.
#
# Needs BOTH Python (the daemon) and Node.js: Irys uploads go through a Node
# subprocess (apps/agent/scripts/irys_upload.mjs using @irys/sdk).
#
# Build context = repo root. Env is injected by Railway (no .env.local shipped);
# pydantic-settings reads the process env directly.
FROM python:3.12-slim

# Node.js + npm for the Irys upload subprocess; uv for Python deps.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

WORKDIR /app
COPY . .

# Node deps for the Irys upload script (@irys/sdk).
RUN cd apps/agent && (npm ci || npm install)

# Python deps for the daemon.
WORKDIR /app/apps/agent
RUN uv sync

# The daemon sys.path-inserts apps/agent and reads scripts/agents/wallets.json
# relative to the repo, so run it from here against the repo-root script.
CMD ["uv", "run", "python", "../../scripts/triad-daemon.py"]
