import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Sprint 17 WP-17.2: schema + wiring checks for the Playground token-consent
// fix. The real behaviour test is "fresh orgs never see playground-minted
// tokens in /dashboard/tokens", which the schema CHECK + the route filter
// together enforce. This test pins those invariants at the source level so a
// future edit can't silently reopen the consent hole.

const MIGRATION = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '20260425170000_gateway_tokens_kind.sql'),
  'utf-8',
);

const PLAYGROUND_TOKEN_LIB = readFileSync(
  join(__dirname, '..', 'lib', 'mcp', 'playground-token.ts'),
  'utf-8',
);

const TOKENS_API = readFileSync(
  join(__dirname, '..', 'app', 'api', 'gateway-tokens', 'route.ts'),
  'utf-8',
);

const TOKENS_PAGE = readFileSync(
  join(__dirname, '..', 'app', 'dashboard', 'tokens', 'page.tsx'),
  'utf-8',
);

describe('WP-17.2 token consent, migration schema', () => {
  it('adds a kind column with the user|system CHECK', () => {
    expect(MIGRATION).toMatch(/add column kind text not null default 'user'/i);
    expect(MIGRATION).toMatch(/check \(kind in \('user', 'system'\)\)/i);
  });

  it('partitions plaintext: system rows require it, user rows forbid it', () => {
    // The paired CHECK on (kind, token_plaintext) is what makes system tokens
    // reusable forever without ever leaking plaintext onto a user-consented row.
    expect(MIGRATION).toMatch(
      /\(kind = 'system' and token_plaintext is not null\)\s*or\s*\(kind = 'user' and token_plaintext is null\)/i,
    );
  });

  it('cleans up pre-fix playground-minted noise', () => {
    expect(MIGRATION).toMatch(/delete from public\.gateway_tokens/i);
    expect(MIGRATION).toMatch(/name like 'playground-%'/i);
  });
});

describe('WP-17.2 token consent, Playground token helper', () => {
  it("mints exactly one system token per org, reused across runs", () => {
    // "kind='system'" on the SELECT proves the reuse path is scoped to system
    // rows. The INSERT sets kind: 'system' so the returned token is never
    // surfaced in the tokens UI (which filters to kind='user').
    expect(PLAYGROUND_TOKEN_LIB).toMatch(/\.eq\('kind', 'system'\)/);
    expect(PLAYGROUND_TOKEN_LIB).toMatch(/kind: 'system'/);
    expect(PLAYGROUND_TOKEN_LIB).toMatch(/token_plaintext: plaintext/);
  });

  it('uses a stable reusable name so repeat calls always hit the same row', () => {
    expect(PLAYGROUND_TOKEN_LIB).toMatch(/PLAYGROUND_SYSTEM_TOKEN_NAME\s*=\s*'playground-internal'/);
  });
});

describe('WP-17.2 token consent, user-facing surface filters', () => {
  it("GET /api/gateway-tokens hides kind='system' rows", () => {
    expect(TOKENS_API).toMatch(/\.eq\('kind', 'user'\)/);
  });

  it("POST /api/gateway-tokens explicitly mints kind='user' (defense in depth on the default)", () => {
    expect(TOKENS_API).toMatch(/kind: 'user'/);
  });

  it("/dashboard/tokens page loader hides kind='system' rows", () => {
    expect(TOKENS_PAGE).toMatch(/\.eq\('kind', 'user'\)/);
  });
});
