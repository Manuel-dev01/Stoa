-- ===================== 005_drop_personas.sql =====================
-- The Lepton pivot: Stoa no longer classifies traces into persona archetypes.
-- The Triad (quantec/bayesian/calibrator) is the only reasoning system now, so
-- the per-trace persona-classification columns are dead. Drop them.
--
-- Run in the Supabase SQL editor.

drop index if exists idx_traces_classified_persona;

alter table traces drop column if exists classified_persona;
alter table traces drop column if exists classification_confidence_bps;
alter table traces drop column if exists classification_rationale;
alter table traces drop column if exists classified_at;

-- ===================== 006_drop_builder_fee.sql =====================
-- The Lepton pivot: the monetization rail is the x402 feed toll, not Polymarket
-- builder fees. Drop the builder-fee accounting: the off-chain builder-code
-- mapping on agents, and the fills table that logged attributed trades.
--
-- Run in the Supabase SQL editor.

drop index if exists idx_fills_agent;
drop table if exists fills;

alter table agents drop column if exists polymarket_builder_code;

-- ===================== 007_triad_memory.sql =====================
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

-- ===================== 008_payment_receipts.sql =====================
-- The Lepton pivot: the x402 tollbooth.
--
-- Every paid feed pull presents an X-402-Payment-Receipt header (an Arc tx
-- hash). The server verifies the tx settled on Arc, paid the toll to the Stoa
-- Treasury, and hasn't been used before. This table is the replay-protection
-- ledger AND the usage/traction log shown in the demo.
--
-- Run in the Supabase SQL editor.

create table if not exists payment_receipts (
  tx_hash text primary key,
  payer text,
  -- USDC amount paid, in whole USDC (e.g. 0.005).
  amount_usdc numeric(20, 6) not null,
  -- The resource the payment unlocked (e.g. '/api/v1/feeds/macro-alpha').
  resource text not null,
  consumed_at timestamptz not null default now()
);
create index if not exists idx_payment_receipts_consumed on payment_receipts(consumed_at desc);

alter table payment_receipts enable row level security;

-- Anonymous read is fine: the receipt ledger is the public traction log. It
-- contains only tx hashes + amounts, no secrets.
create policy "anon read payment_receipts" on payment_receipts for select using (true);
create policy "service insert payment_receipts" on payment_receipts for insert with check (true);

-- ===================== 009_vector_match.sql =====================
-- The Lepton pivot: true ANN retrieval for The Bayesian.
--
-- `match_vector_states` returns the nearest historical prompt→outcome states for
-- a market by cosine distance over the pgvector `embedding` column. The query
-- embedding arrives from PostgREST as a stringified JSON array (text) and is
-- cast to `vector` inside the function. Resolved outcomes are weighted by how
-- close they are, so the Bayesian leans on setups that actually rhyme.
--
-- Run in the Supabase SQL editor (after 007 created triad_vector_state).

-- Cosine-distance ANN index. ivfflat needs ANALYZE to be useful but is fine at
-- our scale; switch to hnsw if the table grows large.
create index if not exists idx_triad_vector_embedding
  on triad_vector_state
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_vector_states(
  query_embedding text,
  p_market_id text,
  match_count int default 5
)
returns table (
  rating smallint,
  outcome text,
  weight real,
  distance float
)
language sql
stable
as $$
  select
    s.rating,
    s.outcome,
    s.weight,
    (s.embedding <=> query_embedding::vector) as distance
  from triad_vector_state s
  where s.market_id = p_market_id
    and s.embedding is not null
  order by s.embedding <=> query_embedding::vector
  limit match_count;
$$;

