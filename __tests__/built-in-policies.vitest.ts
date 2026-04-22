import { describe, expect, it } from 'vitest';
import {
  matchCidr,
  runBasicAuth,
  runClientId,
  runIpAllowlist,
} from '@/lib/policies/built-in';

// Pure-function tests for the three request-metadata policies added in
// WP-G.5. No DB, no manifest — just exercise the runners directly.

describe('runBasicAuth', () => {
  it('allows a valid Basic credential header', () => {
    const v = runBasicAuth({ authorization: 'Basic dXNlcjpwYXNz' });
    expect(v.ok).toBe(true);
  });

  it('accepts lowercase scheme ("basic " prefix)', () => {
    const v = runBasicAuth({ authorization: 'basic dXNlcjpwYXNz' });
    expect(v.ok).toBe(true);
  });

  it('accepts any-case header key (HTTP headers are case-insensitive)', () => {
    const v = runBasicAuth({ Authorization: 'Basic dXNlcjpwYXNz' });
    expect(v.ok).toBe(true);
  });

  it('denies when the Authorization header is missing', () => {
    const v = runBasicAuth({});
    expect(v).toEqual({ ok: false, reason: 'missing_basic_auth' });
  });

  it('denies a Bearer token (wrong scheme)', () => {
    const v = runBasicAuth({ authorization: 'Bearer abc' });
    expect(v).toEqual({ ok: false, reason: 'missing_basic_auth' });
  });

  it('denies when headers are undefined entirely', () => {
    const v = runBasicAuth(undefined);
    expect(v).toEqual({ ok: false, reason: 'missing_basic_auth' });
  });
});

describe('runClientId', () => {
  it('allows when the configured header carries an allowed id', () => {
    const v = runClientId({ 'x-client-id': 'agent-a' }, { allowed_ids: ['agent-a', 'agent-b'] });
    expect(v.ok).toBe(true);
  });

  it('uses a custom header_name when configured', () => {
    const v = runClientId(
      { 'x-caller': 'agent-b' },
      { allowed_ids: ['agent-b'], header_name: 'x-caller' },
    );
    expect(v.ok).toBe(true);
  });

  it('is header-name-case-insensitive', () => {
    const v = runClientId(
      { 'X-Client-Id': 'agent-a' },
      { allowed_ids: ['agent-a'] },
    );
    expect(v.ok).toBe(true);
  });

  it('denies when the header is absent', () => {
    const v = runClientId({}, { allowed_ids: ['agent-a'] });
    expect(v).toEqual({ ok: false, reason: 'client_id_missing' });
  });

  it('denies when the id is not on the allowlist', () => {
    const v = runClientId({ 'x-client-id': 'rogue-agent' }, { allowed_ids: ['agent-a'] });
    expect(v).toEqual({ ok: false, reason: 'client_id_not_allowed' });
  });

  it('denies when config has no allowed_ids (fail-closed)', () => {
    const v = runClientId({ 'x-client-id': 'agent-a' }, {});
    expect(v).toEqual({ ok: false, reason: 'client_id_allowlist_empty' });
  });

  it('denies when headers are undefined entirely', () => {
    const v = runClientId(undefined, { allowed_ids: ['agent-a'] });
    expect(v).toEqual({ ok: false, reason: 'client_id_missing' });
  });
});

describe('runIpAllowlist', () => {
  it('allows an IP inside a /24 block', () => {
    const v = runIpAllowlist('10.0.0.42', { allowed_cidrs: ['10.0.0.0/24'] });
    expect(v.ok).toBe(true);
  });

  it('allows an exact IP (implicit /32)', () => {
    const v = runIpAllowlist('192.168.1.1', { allowed_cidrs: ['192.168.1.1'] });
    expect(v.ok).toBe(true);
  });

  it('allows when any listed CIDR matches', () => {
    const v = runIpAllowlist('172.16.0.5', {
      allowed_cidrs: ['10.0.0.0/8', '172.16.0.0/12'],
    });
    expect(v.ok).toBe(true);
  });

  it('denies an IP outside every block', () => {
    const v = runIpAllowlist('203.0.113.7', { allowed_cidrs: ['10.0.0.0/8'] });
    expect(v).toEqual({ ok: false, reason: 'ip_not_in_allowlist' });
  });

  it('denies when the client IP is missing', () => {
    const v = runIpAllowlist(undefined, { allowed_cidrs: ['10.0.0.0/8'] });
    expect(v).toEqual({ ok: false, reason: 'no_client_ip' });
  });

  it('denies when the allowlist is empty (fail-closed)', () => {
    const v = runIpAllowlist('10.0.0.1', { allowed_cidrs: [] });
    expect(v).toEqual({ ok: false, reason: 'ip_allowlist_empty' });
  });

  it('denies when the allowlist config is missing entirely', () => {
    const v = runIpAllowlist('10.0.0.1', {});
    expect(v).toEqual({ ok: false, reason: 'ip_allowlist_empty' });
  });

  it('denies a malformed IP', () => {
    const v = runIpAllowlist('not-an-ip', { allowed_cidrs: ['10.0.0.0/8'] });
    expect(v).toEqual({ ok: false, reason: 'ip_not_in_allowlist' });
  });
});

describe('matchCidr', () => {
  it('handles /0 as match-all', () => {
    expect(matchCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
  });

  it('handles /32 as exact match', () => {
    expect(matchCidr('1.2.3.4', '1.2.3.4/32')).toBe(true);
    expect(matchCidr('1.2.3.5', '1.2.3.4/32')).toBe(false);
  });

  it('rejects malformed CIDR strings', () => {
    expect(matchCidr('1.2.3.4', '1.2.3.4/33')).toBe(false);
    expect(matchCidr('1.2.3.4', '1.2.3.4/-1')).toBe(false);
    expect(matchCidr('1.2.3.4', 'not-a-cidr')).toBe(false);
  });

  it('rejects malformed IPs', () => {
    expect(matchCidr('999.1.1.1', '10.0.0.0/8')).toBe(false);
    expect(matchCidr('10.0.0', '10.0.0.0/8')).toBe(false);
    expect(matchCidr('', '10.0.0.0/8')).toBe(false);
  });
});
