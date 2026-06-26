-- The Lepton pivot: the monetization rail is the x402 feed toll, not Polymarket
-- builder fees. Drop the builder-fee accounting: the off-chain builder-code
-- mapping on agents, and the fills table that logged attributed trades.
--
-- Run in the Supabase SQL editor.

drop index if exists idx_fills_agent;
drop table if exists fills;

alter table agents drop column if exists polymarket_builder_code;
