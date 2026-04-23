import { describe, expect, it } from 'vitest';
import type { Manifest, PolicyRow } from '@/lib/manifest/cache';
import { runAgentIdentity } from '@/lib/policies/built-in';
import { runPreCallPolicies } from '@/lib/policies/enforce';

// WP-G.14: identity + attribution gate. Four shapes: all headers present →
// ok, one missing → block, empty require_headers list → ok (no-op),
// verify_signature:true → not_implemented (surface is forward-compatible
// without KMS/JWK plumbing).

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

const agentIdentityPolicy = (
  mode: PolicyRow['enforcement_mode'],
  config: Record<string, unknown>,
): PolicyRow => ({
  id: uuid(10),
  name: 'Require agent identity',
  builtin_key: 'agent_identity_required',
  config,
  enforcement_mode: mode,
});

describe('runAgentIdentity (WP-G.14)', () => {
  it('passes when all required headers are present', () => {
    const verdict = runAgentIdentity(
      { 'x-agent-id': 'agent-alpha', 'x-agent-signature': 'abc123' },
      {
        require_headers: ['x-agent-id', 'x-agent-signature'],
        verify_signature: false,
      },
    );
    expect(verdict.ok).toBe(true);
  });

  it('blocks when one required header is missing', () => {
    const verdict = runAgentIdentity(
      { 'x-agent-id': 'agent-alpha' },
      {
        require_headers: ['x-agent-id', 'x-agent-signature'],
        verify_signature: false,
      },
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('agent_identity_missing');
      expect(verdict.detail).toContain('x-agent-signature');
    }
  });

  it('passes when require_headers is empty and signature is off', () => {
    const verdict = runAgentIdentity(
      {},
      { require_headers: [], verify_signature: false },
    );
    expect(verdict.ok).toBe(true);
  });

  it('returns not_implemented when verify_signature is true', () => {
    const verdict = runAgentIdentity(
      { 'x-agent-id': 'agent-alpha' },
      { require_headers: ['x-agent-id'], verify_signature: true },
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('signature_verification_not_implemented');
    }
  });
});

describe('runPreCallPolicies dispatch (agent_identity_required)', () => {
  it('enforce mode blocks when a required header is missing', () => {
    const policy = agentIdentityPolicy('enforce', {
      require_headers: ['x-agent-id'],
      verify_signature: false,
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
      expect(outcome.reason).toBe('agent_identity_missing');
    }
  });
});
