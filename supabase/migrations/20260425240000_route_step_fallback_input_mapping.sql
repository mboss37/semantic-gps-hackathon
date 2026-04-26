-- Sprint 22 WP-22.4 follow-on: per-step fallback input mapping.
--
-- Why: until this migration, executeRoute's fallback handler reused the
-- primary step's resolved args verbatim against the fallback tool. That
-- assumed input-shape compatibility, fine for symmetric tool pairs,
-- broken for cross-MCP fallbacks where the fallback target's schema
-- differs (e.g. chat_post_message {text,channel} → create_issue
-- {owner,repo,title,body}). Sprint 22 E2E surfaced the gap when we
-- added the slack→github fallback edge.
--
-- Mirror of `rollback_input_mapping` (Sprint 10): same DSL via
-- resolveInputMapping, same JSONB column shape, same nullable default
-- (NULL = legacy verbatim-arg behaviour, preserves existing routes).

alter table public.route_steps
  add column if not exists fallback_input_mapping jsonb;

comment on column public.route_steps.fallback_input_mapping is
  'Optional input mapping (DSL: $inputs.x, $steps.key.path) used to translate primary args into the fallback tool''s expected shape. NULL preserves legacy verbatim-arg fallback.';
