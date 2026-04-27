import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LINTER_ONLY_EDGE_TYPES,
  TREL_EDGE_TYPES,
  TREL_NAMESPACE,
  TrelEdgeSchema,
  TrelMetaSchema,
  parseTrelMeta,
} from '@/lib/mcp/trel-schema';

describe('TREL_NAMESPACE', () => {
  it('is the registered-prefix label "trel"', () => {
    expect(TREL_NAMESPACE).toBe('trel');
  });
});

describe('TREL_EDGE_TYPES', () => {
  it('contains exactly the six canonical edge types in declaration order', () => {
    expect(TREL_EDGE_TYPES).toEqual([
      'produces_input_for',
      'requires_before',
      'suggests_after',
      'alternative_to',
      'compensated_by',
      'fallback_to',
    ]);
  });

  it('every DB-allowed relationship_type is classified as either wire-emitted or linter-only (drift guard)', () => {
    // Real invariant: `lib/manifest/cache.ts`'s `RelationshipRow.relationship_type`
    // union is the DB-allowed set. Every member must be either in
    // `TREL_EDGE_TYPES` (emitted on the wire under `_meta.trel`) or in
    // `LINTER_ONLY_EDGE_TYPES` (kept server-side only). Adding a 9th type
    // to cache.ts without classifying it here fails this test and forces
    // a deliberate decision: emit on the wire (extend the SEP) or hide
    // (extend `LINTER_ONLY_EDGE_TYPES`). Without this guard the schema
    // lock at lib/mcp/trel-schema.ts is aspirational, not enforceable.
    const cachePath = fileURLToPath(
      new URL('../lib/manifest/cache.ts', import.meta.url),
    );
    const cacheSource = readFileSync(cachePath, 'utf8');
    const unionMatch = cacheSource.match(
      /relationship_type:\s*([\s\S]*?);/,
    );
    expect(unionMatch).not.toBeNull();
    const unionBlock = unionMatch?.[1] ?? '';
    const dbAllowedTypes = Array.from(
      unionBlock.matchAll(/'([a-z_]+)'/g),
      (m) => m[1],
    );
    expect(dbAllowedTypes.length).toBeGreaterThanOrEqual(
      TREL_EDGE_TYPES.length + LINTER_ONLY_EDGE_TYPES.length,
    );
    const classified = new Set<string>([
      ...TREL_EDGE_TYPES,
      ...LINTER_ONLY_EDGE_TYPES,
    ]);
    for (const t of dbAllowedTypes) {
      expect(
        classified.has(t),
        `relationship_type '${t}' is in lib/manifest/cache.ts RelationshipRow but not classified in TREL_EDGE_TYPES or LINTER_ONLY_EDGE_TYPES; classify it before merging.`,
      ).toBe(true);
    }
  });

  it('TREL_EDGE_TYPES and LINTER_ONLY_EDGE_TYPES are disjoint', () => {
    const wire = new Set<string>(TREL_EDGE_TYPES);
    for (const t of LINTER_ONLY_EDGE_TYPES) {
      expect(wire.has(t)).toBe(false);
    }
  });
});

describe('TrelEdgeSchema', () => {
  it('parses a valid edge object', () => {
    const parsed = TrelEdgeSchema.safeParse({
      to: 'create_issue',
      type: 'produces_input_for',
      description: 'output id is required by the next step',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.to).toBe('create_issue');
      expect(parsed.data.type).toBe('produces_input_for');
    }
  });

  it.each(TREL_EDGE_TYPES)('accepts edge type "%s"', (type) => {
    const parsed = TrelEdgeSchema.safeParse({
      to: 'next_tool',
      type,
      description: 'edge',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown edge type', () => {
    const parsed = TrelEdgeSchema.safeParse({
      to: 'next_tool',
      type: 'mutually_exclusive',
      description: 'not a TRel-emitted type',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an edge with empty `to`', () => {
    const parsed = TrelEdgeSchema.safeParse({
      to: '',
      type: 'fallback_to',
      description: 'd',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an edge whose description exceeds the 500-char cap', () => {
    const parsed = TrelEdgeSchema.safeParse({
      to: 'next_tool',
      type: 'suggests_after',
      description: 'x'.repeat(501),
    });
    expect(parsed.success).toBe(false);
  });
});

describe('TrelMetaSchema', () => {
  it('parses a meta block with both relationships and routes', () => {
    const parsed = TrelMetaSchema.safeParse({
      relationships: [
        { to: 'a', type: 'produces_input_for', description: '' },
      ],
      routes: [
        { name: 'lead_to_issue', step_count: 3, has_fallback: true, has_rollback: true },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('parses an empty `{}` as a valid meta block with both fields undefined', () => {
    const parsed = TrelMetaSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.relationships).toBeUndefined();
      expect(parsed.data.routes).toBeUndefined();
    }
  });
});

describe('parseTrelMeta', () => {
  it('returns null for null', () => {
    expect(parseTrelMeta(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseTrelMeta(undefined)).toBeNull();
  });

  it('returns null for primitives', () => {
    expect(parseTrelMeta(42)).toBeNull();
    expect(parseTrelMeta('trel')).toBeNull();
    expect(parseTrelMeta(true)).toBeNull();
  });

  it('returns null for arrays', () => {
    expect(parseTrelMeta([])).toBeNull();
    expect(parseTrelMeta([{ to: 'a', type: 'fallback_to', description: '' }])).toBeNull();
  });

  it('returns a meta object (with both fields undefined) for `{}`', () => {
    const result = parseTrelMeta({});
    expect(result).not.toBeNull();
    expect(result).toEqual({ relationships: undefined, routes: undefined });
  });

  it('returns the parsed meta block for a well-formed input', () => {
    const result = parseTrelMeta({
      relationships: [
        { to: 'create_issue', type: 'produces_input_for', description: 'data flow' },
      ],
    });
    expect(result?.relationships?.[0]?.to).toBe('create_issue');
    expect(result?.routes).toBeUndefined();
  });

  it('returns null for malformed input without throwing', () => {
    // Bad edge type
    expect(parseTrelMeta({ relationships: [{ to: 'a', type: 'nope', description: '' }] })).toBeNull();
    // Wrong nesting (relationships should be an array)
    expect(parseTrelMeta({ relationships: { to: 'a' } })).toBeNull();
    // Missing required field on a route
    expect(parseTrelMeta({ routes: [{ name: 'r' }] })).toBeNull();
    // Description over the cap
    expect(
      parseTrelMeta({
        relationships: [
          { to: 'a', type: 'fallback_to', description: 'x'.repeat(501) },
        ],
      }),
    ).toBeNull();
  });

  it('never throws on adversarial input', () => {
    const cases: unknown[] = [
      Symbol('s'),
      () => 0,
      Object.create(null),
      new Map([['relationships', []]]),
      { relationships: 'not an array' },
      { routes: 12 },
    ];
    for (const c of cases) {
      expect(() => parseTrelMeta(c)).not.toThrow();
    }
  });
});
