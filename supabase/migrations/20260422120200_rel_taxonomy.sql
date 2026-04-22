-- Sprint 4 WP-B.3: swap the relationship taxonomy to the 8 semantic-flow types
-- locked in docs/USER-STORIES.md. Pre-launch, no prod data — purge all rows,
-- drop the old CHECK, re-add with the canonical set.

delete from public.relationships;

alter table public.relationships
  drop constraint if exists relationships_relationship_type_check;

alter table public.relationships
  add constraint relationships_relationship_type_check
  check (relationship_type in (
    'produces_input_for',
    'requires_before',
    'suggests_after',
    'mutually_exclusive',
    'alternative_to',
    'validates',
    'compensated_by',
    'fallback_to'
  ));
