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
