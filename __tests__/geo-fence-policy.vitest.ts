import { describe, expect, it } from 'vitest';
import type { Manifest, PolicyRow } from '@/lib/manifest/cache';
import { runGeoFence } from '@/lib/policies/built-in';
import { runPreCallPolicies } from '@/lib/policies/enforce';

// WP-G.13: network / data residency gate. Four shapes: allowed → ok,
// blocked → block, missing header → fail-closed, non-'header' source →
// config_invalid (forward-compat surface for org_setting in V2).

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
      name: 'getCustomer',
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

const geoFencePolicy = (
  mode: PolicyRow['enforcement_mode'],
  config: Record<string, unknown>,
): PolicyRow => ({
  id: uuid(10),
  name: 'EU-only data residency',
  builtin_key: 'geo_fence',
  config,
  enforcement_mode: mode,
});

describe('runGeoFence (WP-G.13)', () => {
  it('passes when x-agent-region is in the allowlist', () => {
    const verdict = runGeoFence(
      { 'x-agent-region': 'eu-west' },
      { allowed_regions: ['eu-west', 'eu-central'], source: 'header' },
    );
    expect(verdict.ok).toBe(true);
  });

  it('blocks when region is not in the allowlist', () => {
    const verdict = runGeoFence(
      { 'x-agent-region': 'us-east' },
      { allowed_regions: ['eu-west'], source: 'header' },
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('region_not_allowed');
      expect(verdict.detail).toContain('us-east');
    }
  });

  it('fail-closes when x-agent-region header is missing', () => {
    const verdict = runGeoFence(
      {},
      { allowed_regions: ['eu-west'], source: 'header' },
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('region_missing');
  });

  it('rejects non-header source as config_invalid', () => {
    // Cast because the v1 type locks source to 'header'; the runner still
    // defensively rejects anything else so future config shapes are gated
    // until their runner branch lands.
    const verdict = runGeoFence(
      { 'x-agent-region': 'eu-west' },
      { allowed_regions: ['eu-west'], source: 'org_setting' as 'header' },
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('geo_fence_config_invalid');
  });
});

describe('runPreCallPolicies dispatch (geo_fence)', () => {
  it('enforce mode blocks when header is absent', () => {
    const policy = geoFencePolicy('enforce', {
      allowed_regions: ['eu-west'],
      source: 'header',
    });
    const manifest = buildManifest(
      [policy],
      [{ id: uuid(20), policy_id: policy.id, server_id: SERVER_ID, tool_id: null }],
    );
    const outcome = runPreCallPolicies(
      {
        server_id: SERVER_ID,
        tool_id: TOOL_ID,
        tool_name: 'getCustomer',
        args: {},
        headers: {},
      },
      manifest,
    );
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('region_missing');
    }
  });
});
