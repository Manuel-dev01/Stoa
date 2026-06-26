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
