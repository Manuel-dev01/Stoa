-- The Lepton pivot: the complete, idempotent end-state schema.
--
-- Migrations 001–009 assume a clean sequential history. For a fresh or partially
-- migrated project this single file reproduces the exact final schema the Triad
-- + x402 tollbooth need, using `if (not) exists` everywhere and drop-then-create
-- for policies (which have no IF NOT EXISTS). Safe to re-run.
--
-- Apply with: python scripts/apply-migrations.py 010   (Management API).

create extension if not exists vector;

-- ===== Core: agents + traces (post-pivot shape: no persona/builder columns) =====

create table if not exists agents (
  agent_id text primary key,
  owner_address text not null,
  registered_at timestamptz not null default now(),
  display_handle text,
  framework text
);

create table if not exists traces (
  trace_hash text primary key,
  agent_id text references agents(agent_id),
  market_id text not null,
  rating smallint not null,
  confidence_bps int not null,
  irys_receipt text not null,
  arc_tx_hash text not null,
  block_number bigint not null,
  published_at timestamptz not null,
  venue text default 'polymarket'
);
alter table traces add column if not exists venue text default 'polymarket';

-- The pivot removed these. Drop if a prior schema had them.
alter table traces drop column if exists classified_persona;
alter table traces drop column if exists classification_confidence_bps;
alter table traces drop column if exists classification_rationale;
alter table traces drop column if exists classified_at;
alter table agents drop column if exists polymarket_builder_code;
drop table if exists fills;

create index if not exists idx_traces_agent on traces(agent_id);

-- ===== Triad persistent memory =====

create table if not exists triad_episodic (
  id uuid primary key default gen_random_uuid(),
  agent_id text references agents(agent_id),
  market_id text not null,
  cycle bigint not null,
  features jsonb not null default '{}'::jsonb,
  regime text,
  rhymes_with text,
  created_at timestamptz not null default now()
);
create index if not exists idx_triad_episodic_market on triad_episodic(market_id);
create index if not exists idx_triad_episodic_cycle on triad_episodic(cycle);

create table if not exists triad_vector_state (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  embedding vector(1536),
  rating smallint,
  outcome text,
  weight real not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_triad_vector_market on triad_vector_state(market_id);
create index if not exists idx_triad_vector_embedding
  on triad_vector_state using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists triad_error_log (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  market_id text not null,
  trace_hash text,
  predicted_confidence_bps int,
  predicted_rating smallint,
  resolved_outcome text,
  signed_error real,
  created_at timestamptz not null default now()
);
create index if not exists idx_triad_error_agent on triad_error_log(agent);
create index if not exists idx_triad_error_market on triad_error_log(market_id);

create table if not exists feed_items (
  id uuid primary key default gen_random_uuid(),
  market_id text not null,
  question text not null,
  venue text not null default 'polymarket',
  cycle bigint not null,
  rating smallint not null,
  confidence_bps int not null,
  kelly_fraction real not null default 0,
  synthesis jsonb not null default '{}'::jsonb,
  irys_hash text,
  trace_hash text,
  arc_tx_hash text,
  published_at timestamptz not null default now()
);
create index if not exists idx_feed_items_market on feed_items(market_id);
create index if not exists idx_feed_items_published on feed_items(published_at desc);

-- ===== x402 ledger =====

create table if not exists payment_receipts (
  tx_hash text primary key,
  payer text,
  amount_usdc numeric(20, 6) not null,
  resource text not null,
  consumed_at timestamptz not null default now()
);
create index if not exists idx_payment_receipts_consumed on payment_receipts(consumed_at desc);

-- ===== RLS: anonymous read, service-role write =====

alter table agents enable row level security;
alter table traces enable row level security;
alter table triad_episodic enable row level security;
alter table triad_vector_state enable row level security;
alter table triad_error_log enable row level security;
alter table feed_items enable row level security;
alter table payment_receipts enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'agents','traces','triad_episodic','triad_vector_state',
    'triad_error_log','feed_items','payment_receipts'
  ] loop
    execute format('drop policy if exists "anon read %1$s" on %1$s', t);
    execute format('create policy "anon read %1$s" on %1$s for select using (true)', t);
    execute format('drop policy if exists "service insert %1$s" on %1$s', t);
    execute format('create policy "service insert %1$s" on %1$s for insert with check (true)', t);
  end loop;
  -- writers that also update existing rows
  execute 'drop policy if exists "service update agents" on agents';
  execute 'create policy "service update agents" on agents for update using (true)';
  execute 'drop policy if exists "service update triad_vector_state" on triad_vector_state';
  execute 'create policy "service update triad_vector_state" on triad_vector_state for update using (true)';
end $$;

-- ===== ANN retrieval RPC for The Bayesian =====

create or replace function match_vector_states(
  query_embedding text,
  p_market_id text,
  match_count int default 5
)
returns table (rating smallint, outcome text, weight real, distance float)
language sql
stable
as $$
  select s.rating, s.outcome, s.weight,
         (s.embedding <=> query_embedding::vector) as distance
  from triad_vector_state s
  where s.market_id = p_market_id and s.embedding is not null
  order by s.embedding <=> query_embedding::vector
  limit match_count;
$$;
