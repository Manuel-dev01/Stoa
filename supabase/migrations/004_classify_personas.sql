-- Server-side persona classification.
--
-- Personas were originally a self-declared label at registration. That's now
-- legacy: the canonical persona attribution is a classifier reading each
-- trace's bull/bear/synthesis text against the six archetype rubrics.
--
-- These columns are populated by /api/v1/traces (via Vercel waitUntil, async
-- after publish) and by the backfill script in scripts/backfill-classifications.ts.
-- All nullable: trace publishing succeeds regardless of classifier health.

alter table traces
  add column if not exists classified_persona text,
  add column if not exists classification_confidence_bps int,
  add column if not exists classification_rationale text,
  add column if not exists classified_at timestamptz;

-- Filter pills on the leaderboard hit this index every page render.
create index if not exists idx_traces_classified_persona
  on traces(classified_persona);
