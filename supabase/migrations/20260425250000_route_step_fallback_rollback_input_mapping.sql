-- Sprint 22 WP-22.4 follow-on #2: fallback-aware compensation.
--
-- Problem surfaced during E2E validation: when a step's fallback path
-- succeeds, saga rollback still picks the PRIMARY tool's `compensated_by`
-- edge. Result: the gateway calls the wrong compensator with the wrong
-- args (primary's rollback_input_mapping references capture-bag fields
-- that match the primary tool's output shape, not the fallback target's),
-- compensation fails, and the fallback artifact is orphaned.
--
-- Fix shape: per-step mapping that translates the captured result of a
-- fallback-target tool into its own compensator's expected input. Mirror
-- of `rollback_input_mapping` (Sprint 10) but used only when the step's
-- fallback_used path was taken at runtime. NULL preserves legacy rollback
-- behaviour (never used because legacy fallbacks didn't fall through to
-- a different tool family with shape mismatches).

alter table public.route_steps
  add column if not exists fallback_rollback_input_mapping jsonb;

comment on column public.route_steps.fallback_rollback_input_mapping is
  'Optional input mapping (DSL: $inputs.x, $steps.key.path) used by the saga rollback path WHEN the step fell through to its fallback target. Translates the fallback target''s captured result into its own compensator''s expected input. NULL = no fallback-aware rollback configured for this step.';
