-- Add per-step rollback input mapping. Saga compensation needs its own input
-- derivation because the compensator's schema rarely matches the producer's
-- result shape field-for-field (e.g. GitHub `create_issue` returns `number`
-- but `close_issue` wants `issue_number` + `owner` + `repo` from the
-- ORIGINAL args). Without explicit mapping, rollback fails with invalid_input
-- and the side effect stays on the downstream system.
--
-- DSL mirrors `input_mapping`:
--   $inputs.<field>              , route-level input
--   $steps.<key>.args.<path>     , original args of a captured step
--   $steps.<key>.result.<path>   , post-redaction result of a captured step
--   $steps.<key>.<path>          , backwards-compat, resolves against .result
--
-- Null = fall back to the legacy behaviour (pass the producing step's result
-- verbatim as compensator args). Existing rows are unaffected.

alter table public.route_steps
  add column if not exists rollback_input_mapping jsonb;
