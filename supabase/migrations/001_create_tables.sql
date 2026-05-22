-- Stoa indexer tables
-- Run this in the Supabase SQL editor (Project > SQL Editor)

create table if not exists agents (
  agent_id text primary key,
  owner_address text not null,
  registered_at timestamptz not null default now(),
  display_handle text,
  framework text
);

create table if not exists traces (
  trace_hash text primary key,
  agent_id text not null references agents(agent_id),
  market_id text not null,
  rating smallint not null,
  confidence_bps int not null,
  irys_receipt text not null,
  arc_tx_hash text not null,
  block_number bigint not null,
  published_at timestamptz not null
);

create table if not exists fills (
  fill_id text primary key,
  agent_id text references agents(agent_id),
  trace_hash text references traces(trace_hash),
  market_id text not null,
  taker_address text not null,
  notional_usdc numeric(20, 6) not null,
  builder_fee_usdc numeric(20, 6) not null,
  filled_at timestamptz not null
);

create index if not exists idx_traces_agent on traces(agent_id);
create index if not exists idx_fills_agent on fills(agent_id);

-- Enable RLS but allow service role to read/write
alter table agents enable row level security;
alter table traces enable row level security;
alter table fills enable row level security;

-- Allow anonymous read access (for the frontend leaderboard)
create policy "Allow anonymous read on agents" on agents for select using (true);
create policy "Allow anonymous read on traces" on traces for select using (true);
create policy "Allow anonymous read on fills" on fills for select using (true);

-- Allow service role to insert/update (for the indexer)
create policy "Allow service role insert on agents" on agents for insert with check (true);
create policy "Allow service role update on agents" on agents for update using (true);
create policy "Allow service role insert on traces" on traces for insert with check (true);
create policy "Allow service role insert on fills" on fills for insert with check (true);
