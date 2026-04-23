import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manifest, PolicyRow } from '@/lib/manifest/cache';
import { runIdempotency } from '@/lib/policies/built-in';
import { runPreCallPolicies } from '@/lib/policies/enforce';
import { __resetIdempotencyStoreForTests } from '@/lib/policies/idempotency-store';

// WP-G.15: duplicate-request dedupe. Five shapes: first call with header ok,
// duplicate within TTL blocked, call after TTL expiry ok, args_hash
// first+duplicate first ok second block, missing x-idempotency-key with
// source='header' fail-closed.

const uuid = (n: number): string =>
  `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const SERVER_ID = uuid(1);
const TOOL_ID = uuid(2);

const buildManifest = (
  policies: PolicyRow[],
  assignments: Manifest['assignments'],
): Manifest => ({
  loadedAt: Date.now(),
  servers: [],
  tools: [
    {
      id: TOOL_ID,
      server_id: SERVER_ID,
      name: 'create_task',
      description: null,
      input_schema: {},
    },
  ],
  relationships: [],
  policies,
  assignments,
  routes: [],
  route_steps: [],
});

const idempotencyPolicy = (
  mode: PolicyRow['enforcement_mode'],
  config: Record<string, unknown>,
): PolicyRow => ({
  id: uuid(10),
  name: 'Idempotent writes',
  builtin_key: 'idempotency_required',
  config,
  enforcement_mode: mode,
});

describe('runIdempotency (WP-G.15)', () => {
  beforeEach(() => {
    __resetIdempotencyStoreForTests();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the first call when the header is present', () => {
    const verdict = runIdempotency(
      {
        tool_name: 'create_task',
        args: { title: 'fix logins' },
        headers: { 'x-idempotency-key': 'req-001' },
      },
      { ttl_seconds: 60, key_source: 'header' },
    );
    expect(verdict.ok).toBe(true);
  });

  it('blocks a duplicate call inside the TTL window', () => {
    const ctx = {
      tool_name: 'create_task',
      args: { title: 'fix logins' },
      headers: { 'x-idempotency-key': 'req-002' },
    };
    const config = { ttl_seconds: 60, key_source: 'header' as const };
    expect(runIdempotency(ctx, config).ok).toBe(true);
    const second = runIdempotency(ctx, config);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe('duplicate_request');
      expect(second.detail).toContain('req-002');
    }
  });

  it('allows the call again once the TTL expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0, 0));
    const ctx = {
      tool_name: 'create_task',
      args: { title: 'q2 planning' },
      headers: { 'x-idempotency-key': 'req-003' },
    };
    const config = { ttl_seconds: 10, key_source: 'header' as const };
    expect(runIdempotency(ctx, config).ok).toBe(true);
    // Advance 11s — entry is stale, new window.
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0, 11));
    expect(runIdempotency(ctx, config).ok).toBe(true);
  });

  it('dedupes on args_hash when no header is available', () => {
    const ctx = {
      tool_name: 'create_task',
      args: { title: 'ship thing', priority: 'p0' },
    };
    const config = { ttl_seconds: 60, key_source: 'args_hash' as const };
    expect(runIdempotency(ctx, config).ok).toBe(true);
    const second = runIdempotency(ctx, config);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('duplicate_request');

    // Different args → different hash → fresh window.
    const different = runIdempotency(
      { ...ctx, args: { title: 'ship thing', priority: 'p1' } },
      config,
    );
    expect(different.ok).toBe(true);
  });

  it('fail-closes when source=header and the header is missing', () => {
    const verdict = runIdempotency(
      { tool_name: 'create_task', args: {}, headers: {} },
      { ttl_seconds: 60, key_source: 'header' },
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('idempotency_key_missing');
  });
});

describe('runPreCallPolicies dispatch (idempotency_required)', () => {
  beforeEach(() => {
    __resetIdempotencyStoreForTests();
  });

  it('enforce mode blocks a duplicate args_hash call', () => {
    const policy = idempotencyPolicy('enforce', {
      ttl_seconds: 60,
      key_source: 'args_hash',
    });
    const manifest = buildManifest(
      [policy],
      [{ id: uuid(20), policy_id: policy.id, server_id: SERVER_ID, tool_id: null }],
    );
    const first = runPreCallPolicies(
      {
        server_id: SERVER_ID,
        tool_id: TOOL_ID,
        tool_name: 'create_task',
        args: { title: 'dedupe me' },
      },
      manifest,
    );
    expect(first.action).toBe('allow');

    const second = runPreCallPolicies(
      {
        server_id: SERVER_ID,
        tool_id: TOOL_ID,
        tool_name: 'create_task',
        args: { title: 'dedupe me' },
      },
      manifest,
    );
    expect(second.action).toBe('block');
    if (second.action === 'block') {
      expect(second.reason).toBe('duplicate_request');
    }
  });
});
