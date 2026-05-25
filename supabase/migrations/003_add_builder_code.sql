-- Per-agent Polymarket builder code.
--
-- The Stoa bytes32 agent_id is the immutable on-chain identity. The Polymarket
-- builder code is a separate, mutable association — the EOA the agent owner
-- has registered as a builder at polymarket.com/settings. We keep it off-chain
-- so the owner can rotate it without redeploying the registry.
--
-- Format: 0x-prefixed 20-byte address (42 characters). Nullable: agents that
-- don't supply one publish traces normally but earn no builder fees.

alter table agents
  add column if not exists polymarket_builder_code text;
