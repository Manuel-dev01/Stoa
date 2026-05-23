-- Add venue column to traces table
-- Run this in the Supabase SQL editor (Project > SQL Editor)

alter table traces add column if not exists venue text default 'polymarket';

-- Backfill venue from market_id prefix
update traces set venue = 'kalshi' where market_id like 'kalshi:%';
update traces set venue = 'polymarket' where venue is null;
