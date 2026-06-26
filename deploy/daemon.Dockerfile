# Triad daemon — runs the three-engine Triad over the top macro/crypto markets,
# anchors each synthesis on Irys + Arc, and writes the feed_items the x402 feed
# serves. Long-running worker (internal sleep loop), no HTTP.
#
# Build context = repo root. Env is injected by Railway (no .env.local shipped);
# pydantic-settings reads the process env directly.
FROM python:3.12-slim

# uv for fast, reproducible Python deps.
RUN pip install --no-cache-dir uv

WORKDIR /app
COPY . .

# Resolve the agent's dependencies.
WORKDIR /app/apps/agent
RUN uv sync

# The daemon sys.path-inserts apps/agent and reads scripts/agents/wallets.json
# relative to the repo, so run it from here against the repo-root script.
CMD ["uv", "run", "python", "../../scripts/triad-daemon.py"]
