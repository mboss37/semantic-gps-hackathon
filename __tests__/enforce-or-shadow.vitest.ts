import { describe, expect, it } from 'vitest';
import type { Manifest, PolicyRow } from '@/lib/manifest/cache';
import { runPiiRedaction } from '@/lib/policies/built-in';
import { runPostCallPolicies, runPreCallPolicies } from '@/lib/policies/enforce';

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const SERVER_ID = uuid(1);
const TOOL_ID = uuid(2);

const buildManifest = (policies: PolicyRow[], assignments: Manifest['assignments']): Manifest => ({
  loadedAt: Date.now(),
  servers: [],
  tools: [{ id: TOOL_ID, server_id: SERVER_ID, name: 'getCustomer', description: null, input_schema: {} }],
  relationships: [],
  policies,
  assignments,
});

const pii = (mode: PolicyRow['enforcement_mode']): PolicyRow => ({
  id: uuid(10),
  name: 'Redact PII in outputs',
  builtin_key: 'pii_redaction',
  config: {},
  enforcement_mode: mode,
});

const allowlist = (mode: PolicyRow['enforcement_mode']): PolicyRow => ({
  id: uuid(11),
  name: 'Only getCustomer',
  builtin_key: 'allowlist',
  config: { tool_names: ['getCustomer'] },
  enforcement_mode: mode,
});

const resultWithPii = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-867-5309',
};

describe('runPreCallPolicies (allowlist)', () => {
  it('enforce mode blocks tools outside the allowlist', () => {
    const policy = allowlist('enforce');
    const manifest = buildManifest([policy], [
      { id: uuid(20), policy_id: policy.id, server_id: SERVER_ID, tool_id: null },
    ]);
    const outcome = runPreCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'sendEmail', args: {} },
      manifest,
    );
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toMatch(/allowlist/i);
      expect(outcome.decisions[0]?.decision).toBe('block');
      expect(outcome.decisions[0]?.mode).toBe('enforce');
    }
  });

  it('shadow mode records the decision but lets the call through', () => {
    const policy = allowlist('shadow');
    const manifest = buildManifest([policy], [
      { id: uuid(21), policy_id: policy.id, server_id: SERVER_ID, tool_id: null },
    ]);
    const outcome = runPreCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'sendEmail', args: {} },
      manifest,
    );
    expect(outcome.action).toBe('allow');
    expect(outcome.decisions[0]?.decision).toBe('block');
    expect(outcome.decisions[0]?.mode).toBe('shadow');
  });
});

describe('runPostCallPolicies (pii_redaction)', () => {
  it('enforce mode redacts the result', () => {
    const policy = pii('enforce');
    const manifest = buildManifest([policy], [
      { id: uuid(30), policy_id: policy.id, server_id: SERVER_ID, tool_id: null },
    ]);
    const outcome = runPostCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'getCustomer', args: {}, result: resultWithPii },
      manifest,
    );
    const redacted = outcome.result as typeof resultWithPii;
    expect(redacted.email).toBe('[redacted:email]');
    expect(redacted.phone).toBe('[redacted:phone]');
    expect(redacted.name).toBe('Jane Doe');
    expect(outcome.decisions[0]?.decision).toBe('redact');
    expect(outcome.decisions[0]?.match_samples?.length).toBeGreaterThan(0);
  });

  it('shadow mode leaves the result untouched but flags the match', () => {
    const policy = pii('shadow');
    const manifest = buildManifest([policy], [
      { id: uuid(31), policy_id: policy.id, server_id: SERVER_ID, tool_id: null },
    ]);
    const outcome = runPostCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'getCustomer', args: {}, result: resultWithPii },
      manifest,
    );
    expect(outcome.result).toEqual(resultWithPii);
    expect(outcome.decisions[0]?.decision).toBe('redact');
    expect(outcome.decisions[0]?.mode).toBe('shadow');
  });

  it('no assigned policy leaves result untouched and records no decisions', () => {
    const manifest = buildManifest([], []);
    const outcome = runPostCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'getCustomer', args: {}, result: resultWithPii },
      manifest,
    );
    expect(outcome.result).toEqual(resultWithPii);
    expect(outcome.decisions).toHaveLength(0);
  });
});

describe('runPiiRedaction standalone', () => {
  it('recurses into nested objects and arrays', () => {
    const out = runPiiRedaction({
      customers: [
        { email: 'a@b.com', phone: '555-111-2222' },
        { email: 'c@d.com', details: { ssn: '123-45-6789' } },
      ],
    });
    expect(out.match_count).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(out.redacted)).not.toMatch(/@b\.com|@d\.com|555-111-2222|123-45-6789/);
  });

  it('leaves UUIDs, timestamps, and long digit runs alone (no CC false-positive)', () => {
    const notPii = {
      id: '11111111-1111-1111-1111-111111111111',
      demo_uuid_no_hex: '22222222-2222-2222-2222-222222222222',
      ms_ts: 1713600000000,
      order_number: '900000001234567',
    };
    const out = runPiiRedaction(notPii);
    expect(out.match_count).toBe(0);
    expect(out.redacted).toEqual(notPii);
  });

  it('still flags a Visa-shaped PAN', () => {
    const out = runPiiRedaction({ payment: 'card 4532015112830366 expires soon' });
    expect(out.match_count).toBeGreaterThan(0);
    expect(JSON.stringify(out.redacted)).toContain('[redacted:cc]');
  });
});
