import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Load .env.local into process.env so DB integration + opt-in E2E tests
// see Supabase / Anthropic creds without a separate shell `source` step.
// Shell-set vars win — lets CI and one-off runs override file values.
const loadDotenvLocal = (): void => {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // no .env.local — tests either get env from shell or skip via skipIf
  }
};
loadDotenvLocal();

const FORWARDED_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'CREDENTIALS_ENCRYPTION_KEY',
  'VERIFY_ANTHROPIC',
  'VERIFY_REAL_PROXY',
  'VERIFY_GATEWAY_URL',
  'VERIFY_SALESFORCE',
  'SF_LOGIN_URL',
  'SF_CLIENT_ID',
  'SF_CLIENT_SECRET',
  'VERIFY_SLACK',
  'SLACK_BOT_TOKEN',
  'VERIFY_GITHUB',
  'GITHUB_PAT',
  'GITHUB_DEMO_REPO',
  'SSRF_ALLOW_LOCALHOST',
  'REAL_PROXY_ENABLED',
] as const;

const forwardedEnv: Record<string, string> = {};
for (const key of FORWARDED_ENV_KEYS) {
  const value = process.env[key];
  if (value !== undefined) forwardedEnv[key] = value;
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.vitest.ts'],
    globals: false,
    env: forwardedEnv,
  },
});
