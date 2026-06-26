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
