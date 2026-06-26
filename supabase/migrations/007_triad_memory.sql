-- The Lepton pivot: persistent memory for the Triad.
--
--   triad_episodic     — The Quantec's regime-loop log (one row per market/cycle).
--   triad_vector_state — The Bayesian's rolling prompt→outcome embeddings (pgvector).
--   triad_error_log    — per-agent calibration error on resolved markets; the
--                        Calibrator reads this to penalize a prior-wrong agent.
--   feed_items         — the published synthesized Triad output that the
--                        x402-gated feed serves (one row per market per cycle).
--
-- Run in the Supabase SQL editor. Requires the `vector` extension (pgvector),
-- available on Supabase by default.

create extension if not exists vector;

-- The Quantec's episodic memory: structural features + the regime it mapped to.
create table if not exists triad_episodic (
  id uuid primary key default gen_random_uuid(),
  agent_id text references agents(agent_id),
  market_id text not null,
  cycle bigint not null,
  -- Structural snapshot: order-book depth/imbalance, funding, vol, macro actuals.
  features jsonb not null default '{}'::jsonb,
  -- The regime label the Quantec assigned (e.g. "risk-off tightening").
  regime text,
  -- The historical loop this cycle rhymed with, if any.
  rhymes_with text,
  created_at timestamptz not null default now()
);
create index if not exists idx_triad_episodic_market on triad_episodic(market_id);
create index if not exists idx_triad_episodic_cycle on triad_episodic(cycle);

-- The Bayesian's rolling vector memory: a setup embedding plus its realized
-- outcome and a confidence weight that updates on market resolution.
create table if not exists triad_vector_state (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  -- Embedding of the setup prompt. 1536 dims = OpenAI/DeepSeek small-embed size;
  -- change to match your embedder before first write.
  embedding vector(1536),
  -- Directional state the Bayesian recorded for this setup (-3..3).
  rating smallint,
  -- Realized outcome once the market resolves: 'yes' | 'no' | 'void' | null.
  outcome text,
  -- Evidence weight; decays/boosts as outcomes land.
  weight real not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_triad_vector_market on triad_vector_state(market_id);

-- Per-agent calibration error on resolved markets. The Calibrator reads the
-- recent rows for an agent and shrinks its contribution in proportion to error.
create table if not exists triad_error_log (
  id uuid primary key default gen_random_uuid(),
  -- 'quantec' | 'bayesian' (the Calibrator judges these two).
  agent text not null,
  market_id text not null,
  trace_hash text,
  -- What the agent predicted vs. what happened, as confidence in bps.
  predicted_confidence_bps int,
  predicted_rating smallint,
  resolved_outcome text,         -- 'yes' | 'no' | 'void'
  -- Signed calibration error in [-1, 1]: + = overconfident-and-wrong.
  signed_error real,
  created_at timestamptz not null default now()
);
create index if not exists idx_triad_error_agent on triad_error_log(agent);
create index if not exists idx_triad_error_market on triad_error_log(market_id);

-- The published feed: the Triad's synthesized object per market per cycle.
create table if not exists feed_items (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  question text not null,
  venue text not null default 'polymarket',
  cycle bigint not null,
  -- Final reconciled call.
  rating smallint not null,
  confidence_bps int not null,
  kelly_fraction real not null default 0,
  -- Full synthesis payload: bull/bear/synthesis + per-agent breakdown.
  synthesis jsonb not null default '{}'::jsonb,
  -- Cryptographic receipts so consumers can verify the data.
  irys_hash text,
  trace_hash text,
  arc_tx_hash text,
  published_at timestamptz not null default now()
);
create index if not exists idx_feed_items_market on feed_items(market_id);
create index if not exists idx_feed_items_published on feed_items(published_at desc);

-- RLS: anonymous read on the public feed + memory; service-role writes only.
alter table triad_episodic enable row level security;
alter table triad_vector_state enable row level security;
alter table triad_error_log enable row level security;
alter table feed_items enable row level security;

create policy "anon read triad_episodic" on triad_episodic for select using (true);
create policy "anon read triad_vector_state" on triad_vector_state for select using (true);
create policy "anon read triad_error_log" on triad_error_log for select using (true);
create policy "anon read feed_items" on feed_items for select using (true);

create policy "service insert triad_episodic" on triad_episodic for insert with check (true);
create policy "service insert triad_vector_state" on triad_vector_state for insert with check (true);
create policy "service update triad_vector_state" on triad_vector_state for update using (true);
create policy "service insert triad_error_log" on triad_error_log for insert with check (true);
create policy "service insert feed_items" on feed_items for insert with check (true);
