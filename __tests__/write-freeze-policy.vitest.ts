import { describe, expect, it } from 'vitest';
import type { Manifest, PolicyRow } from '@/lib/manifest/cache';
import { runWriteFreeze } from '@/lib/policies/built-in';
import { runPreCallPolicies } from '@/lib/policies/enforce';

// WP-G.11: the "read-only mode" kill switch. Three shapes exercised: disabled,
// enabled without a subset (freeze-all), enabled with a subset (freeze-named).

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

const writeFreezePolicy = (
  mode: PolicyRow['enforcement_mode'],
  config: Record<string, unknown>,
): PolicyRow => ({
  id: uuid(10),
  name: 'Incident write freeze',
  builtin_key: 'write_freeze',
  config,
  enforcement_mode: mode,
});

describe('runWriteFreeze (WP-G.11)', () => {
  it('passes when disabled regardless of tool name', () => {
    const disabled = { enabled: false };
    expect(runWriteFreeze('create_task', disabled).ok).toBe(true);
    expect(runWriteFreeze('find_account', disabled).ok).toBe(true);
    expect(runWriteFreeze('delete_record', disabled).ok).toBe(true);
  });

  it('blocks every tool when enabled without a tool_names subset', () => {
    const enabled = { enabled: true };
    const v1 = runWriteFreeze('create_task', enabled);
    expect(v1.ok).toBe(false);
    if (!v1.ok) expect(v1.reason).toBe('write_freeze_active');

    const v2 = runWriteFreeze('find_account', enabled);
    expect(v2.ok).toBe(false);
    if (!v2.ok) expect(v2.reason).toBe('write_freeze_active');
  });

  it('blocks only named tools when tool_names is set', () => {
    const subset = { enabled: true, tool_names: ['create_task'] };

    // Not in the list → passes.
    expect(runWriteFreeze('find_account', subset).ok).toBe(true);

    // In the list → blocks.
    const blocked = runWriteFreeze('create_task', subset);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toBe('write_freeze_active');
      expect(blocked.detail).toContain('create_task');
    }
  });
});

describe('runPreCallPolicies dispatch (write_freeze)', () => {
  it('enforce mode blocks the named tool when enabled', () => {
    const policy = writeFreezePolicy('enforce', {
      enabled: true,
      tool_names: ['create_task'],
    });
    const manifest = buildManifest(
      [policy],
      [{ id: uuid(20), policy_id: policy.id, server_id: SERVER_ID, tool_id: null }],
    );
    const outcome = runPreCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'create_task', args: {} },
      manifest,
    );
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('write_freeze_active');
    }
  });

  it('passes the call through when write freeze is disabled', () => {
    const policy = writeFreezePolicy('enforce', { enabled: false });
    const manifest = buildManifest(
      [policy],
      [{ id: uuid(21), policy_id: policy.id, server_id: SERVER_ID, tool_id: null }],
    );
    const outcome = runPreCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'create_task', args: {} },
      manifest,
    );
    expect(outcome.action).toBe('allow');
  });
});
