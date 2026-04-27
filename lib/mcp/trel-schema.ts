// TRel: Tool Relationships namespace under MCP `_meta`.
//
// MCP servers attach implementation-specific data to tools/resources via the
// `_meta` field already standardized in the protocol. This file is the
// normative reference for the `trel` registered prefix on that field, the
// shape Semantic GPS emits today and the canonical shape that any future
// SEP submission to the official MCP spec repo will reference verbatim.
//
// Wire shape on every tool returned by `tools/list`:
//   {
//     name, description, inputSchema,
//     _meta: {
//       trel: {
//         relationships?: TrelEdge[],
//         routes?: TrelRouteRef[]
//       }
//     }
//   }
//
// The six-edge vocabulary covers the patterns enterprise sagas actually need
// (data-flow, prerequisite, soft recommendation, substitute, compensator,
// fallback). Validators (`mutually_exclusive`, `validates`) live in the
// implementation's internal relationship table but are NOT part of the
// canonical `_meta.trel` emission set, they are linter-only inputs to
// `validate_workflow` and intentionally out of scope for the SEP.
//
// Stability contract: this file is the single source of shape truth for any
// callsite that produces or consumes `_meta.trel`. Adding a new edge type
// requires (a) updating this enum, (b) updating
// `lib/mcp/stateless-server.ts` to emit it, (c) revising the SEP draft.

import { z } from 'zod';

export const TREL_NAMESPACE = 'trel' as const;

export const TREL_EDGE_TYPES = [
  'produces_input_for',
  'requires_before',
  'suggests_after',
  'alternative_to',
  'compensated_by',
  'fallback_to',
] as const;

// Linter-only edge types: present in the relationships table + DB CHECK
// constraint (see lib/manifest/cache.ts RelationshipRow.relationship_type
// + supabase/migrations/20260422120200_rel_taxonomy.sql) but NOT emitted
// on `_meta.trel.relationships`. They feed `validate_workflow` and similar
// internal lints. Drift guard in `__tests__/trel-schema.vitest.ts` asserts
// every DB-allowed type is in TREL_EDGE_TYPES ∪ LINTER_ONLY_EDGE_TYPES so
// a new addition forces a deliberate decision: emit-on-wire (extend the
// SEP) or hide (extend this constant).
export const LINTER_ONLY_EDGE_TYPES = ['mutually_exclusive', 'validates'] as const;

export type TrelEdgeType = (typeof TREL_EDGE_TYPES)[number];

export const TrelEdgeTypeSchema = z.enum(TREL_EDGE_TYPES);

export const TrelEdgeSchema = z.object({
  to: z.string().min(1).max(200),
  type: TrelEdgeTypeSchema,
  description: z.string().max(500),
});

export type TrelEdge = z.infer<typeof TrelEdgeSchema>;

export const TrelRouteRefSchema = z.object({
  name: z.string().min(1).max(200),
  step_count: z.number().int().min(0),
  has_fallback: z.boolean(),
  has_rollback: z.boolean(),
});

export type TrelRouteRef = z.infer<typeof TrelRouteRefSchema>;

export const TrelMetaSchema = z.object({
  relationships: z.array(TrelEdgeSchema).optional(),
  routes: z.array(TrelRouteRefSchema).optional(),
});

export type TrelMeta = z.infer<typeof TrelMetaSchema>;

// Defensive parser for `_meta.trel` reads. Returns null on absent or
// malformed input so callers can branch without try/catch. Never throws.
//
// `null`, `undefined`, primitives, and arrays at the top level all fail
// closed (return null). A bare `{}` parses successfully to a meta object
// with both fields undefined, that is a valid empty TRel block per the
// schema, distinct from "the field is absent."
export const parseTrelMeta = (rawMeta: unknown): TrelMeta | null => {
  if (rawMeta === null || rawMeta === undefined) return null;
  if (typeof rawMeta !== 'object' || Array.isArray(rawMeta)) return null;
  const result = TrelMetaSchema.safeParse(rawMeta);
  if (!result.success) return null;
  return result.data;
};
