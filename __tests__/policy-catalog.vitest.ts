import { describe, expect, it } from 'vitest';
import {
  DIMENSION_LABELS,
  POLICY_CATALOG,
  type PolicyDimension,
} from '@/lib/policies/catalog';

// Sprint 17 WP-17.1: pins the Mulesoft-pattern catalog shape so judges (and
// new signups) always see every shipped builtin runner on the gallery. If a
// runner lands in `lib/policies/runners/` without a catalog entry, this test
// fails — forcing the gallery to stay in sync with the enforcement layer.

const EXPECTED_BUILTINS = [
  'pii_redaction',
  'injection_guard',
  'rate_limit',
  'allowlist',
  'business_hours',
  'write_freeze',
  'basic_auth',
  'client_id',
  'ip_allowlist',
  'geo_fence',
  'agent_identity_required',
  'idempotency_required',
] as const;

const EXPECTED_DIMENSIONS: PolicyDimension[] = [
  'time',
  'rate',
  'identity',
  'residency',
  'hygiene',
  'kill-switch',
  'idempotency',
];

describe('POLICY_CATALOG', () => {
  it('covers all 12 shipped builtin runners', () => {
    const keys = POLICY_CATALOG.map((e) => e.builtin_key).sort();
    expect(keys).toEqual([...EXPECTED_BUILTINS].sort());
  });

  it('has unique builtin_keys (no catalog duplicates)', () => {
    const keys = POLICY_CATALOG.map((e) => e.builtin_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('spans all 7 governance dimensions', () => {
    const dims = new Set(POLICY_CATALOG.map((e) => e.dimension));
    for (const d of EXPECTED_DIMENSIONS) {
      expect(dims.has(d)).toBe(true);
    }
  });

  it('every entry has a non-empty title, description, and at least one config key', () => {
    for (const entry of POLICY_CATALOG) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(20);
      expect(entry.config_keys.length).toBeGreaterThan(0);
    }
  });

  it('every dimension has a human-readable label', () => {
    for (const entry of POLICY_CATALOG) {
      expect(DIMENSION_LABELS[entry.dimension]).toBeTruthy();
    }
  });
});
