import { z } from 'zod';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import { VendorError } from '@/lib/mcp/vendors/errors';

// Salesforce MCP vendor seam. Owns OAuth client-credentials token minting +
// REST dispatch for the 6 curated SF tools. Credentials come from env vars
// (`SF_LOGIN_URL` / `SF_CLIENT_ID` / `SF_CLIENT_SECRET`), this module ships
// alongside the gateway today and can be extracted to its own deploy later
// with zero gateway-side changes.
//
// The HTTP route in `app/api/mcps/salesforce/route.ts` is a thin JSON-RPC
// adapter that calls `dispatchSalesforceTool` for `tools/call` and lists the
// per-tool schemas for `tools/list`.

const TIMEOUT_MS = 10_000;
const TOKEN_SKEW_MS = 60_000;
const DEFAULT_TOKEN_TTL_S = 7200;
const RETRY_BACKOFF_MS = 200;
const SALESFORCE_API_VERSION = 'v60.0';

export type SalesforceCreds = {
  login_url: string;
  client_id: string;
  client_secret: string;
};

type TokenCacheEntry = {
  access_token: string;
  expires_at: number;
  instance_url: string;
};

// Module-level token cache. Single-process, every serverless cold start
// mints a fresh token. Cache key is the login_url so future multi-tenant
// extraction (per-org creds) plugs in cleanly.
const tokenCache = new Map<string, TokenCacheEntry>();

export const __resetSalesforceTokenCacheForTests = (): void => {
  tokenCache.clear();
};

export const invalidateSalesforceToken = (loginUrl: string): void => {
  tokenCache.delete(loginUrl);
};

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  instance_url: z.string().url(),
  expires_in: z.number().int().positive().optional(),
});

const SoqlResponseSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())),
});

const SalesforceErrorArray = z.array(
  z.object({ message: z.string().optional(), errorCode: z.string().optional() }),
);

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// SOQL single-quote escape. `'` and `\` are the breakout chars per Salesforce
// docs. id/email formats are validated separately before we compose SOQL.
export const soqlEscape = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const loadCredsFromEnv = (): SalesforceCreds | null => {
  const login_url = process.env.SF_LOGIN_URL ?? '';
  const client_id = process.env.SF_CLIENT_ID ?? '';
  const client_secret = process.env.SF_CLIENT_SECRET ?? '';
  if (!login_url || !client_id || !client_secret) return null;
  return { login_url, client_id, client_secret };
};

const mintToken = async (creds: SalesforceCreds): Promise<TokenCacheEntry> => {
  const base = creds.login_url.replace(/\/+$/, '');
  const url = `${base}/services/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.client_id,
    client_secret: creds.client_secret,
  });

  let res: Response;
  try {
    res = await safeFetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: body.toString(),
      timeoutMs: TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    throw new VendorError(502, 'network_error');
  }
  const text = await res.text();
  if (!res.ok) throw new VendorError(res.status, 'upstream_auth_failed');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new VendorError(502, 'upstream_auth_failed', 'token response not json');
  }
  const ok = TokenResponseSchema.safeParse(parsed);
  if (!ok.success) throw new VendorError(502, 'upstream_auth_failed', 'token response shape');
  const ttl = ok.data.expires_in ?? DEFAULT_TOKEN_TTL_S;
  return {
    access_token: ok.data.access_token,
    instance_url: ok.data.instance_url,
    expires_at: Date.now() + ttl * 1000,
  };
};

const getAccessToken = async (
  creds: SalesforceCreds,
  forceRefresh = false,
): Promise<TokenCacheEntry> => {
  if (!forceRefresh) {
    const hit = tokenCache.get(creds.login_url);
    if (hit && Date.now() < hit.expires_at - TOKEN_SKEW_MS) return hit;
  }
  const fresh = await mintToken(creds);
  tokenCache.set(creds.login_url, fresh);
  return fresh;
};

type CallInit = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
};

// Generic SF REST call, 401 single-retry (refresh token), 5xx single-retry.
// 204 returns body: null. Non-2xx maps to VendorError with status preserved.
const sfCall = async (
  creds: SalesforceCreds,
  token: TokenCacheEntry,
  call: CallInit,
): Promise<{ token: TokenCacheEntry; body: unknown }> => {
  const url = `${token.instance_url.replace(/\/+$/, '')}${call.path}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${token.access_token}`,
    accept: 'application/json',
  };
  const init: RequestInit & { timeoutMs?: number } = {
    method: call.method,
    headers,
    timeoutMs: TIMEOUT_MS,
  };
  if (call.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(call.body);
  }

  const attempt = async (): Promise<Response> => safeFetch(url, init);

  let currentToken = token;
  let res: Response;
  try {
    res = await attempt();
    if (res.status === 401) {
      await res.text().catch(() => '');
      invalidateSalesforceToken(creds.login_url);
      currentToken = await getAccessToken(creds, true);
      headers.authorization = `Bearer ${currentToken.access_token}`;
      res = await attempt();
    }
    if (res.status >= 500 && res.status < 600) {
      await res.text().catch(() => '');
      await delay(RETRY_BACKOFF_MS);
      res = await attempt();
    }
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    throw new VendorError(502, 'network_error');
  }

  const text = await res.text();

  if (res.status === 401) throw new VendorError(401, 'upstream_auth_failed');

  if (!res.ok) {
    let detail: string | undefined;
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        const arr = SalesforceErrorArray.safeParse(parsed);
        if (arr.success && arr.data.length > 0) detail = arr.data[0].message;
        else if (parsed && typeof parsed === 'object' && 'message' in parsed) {
          const msg = (parsed as { message?: unknown }).message;
          if (typeof msg === 'string') detail = msg;
        }
      } catch {
        // non-json body, ignore
      }
    }
    throw new VendorError(res.status, 'origin_error', detail);
  }

  if (!text) return { token: currentToken, body: null };
  try {
    return { token: currentToken, body: JSON.parse(text) };
  } catch {
    throw new VendorError(502, 'parse_error');
  }
};

const soqlQuery = async (
  creds: SalesforceCreds,
  token: TokenCacheEntry,
  query: string,
): Promise<{ token: TokenCacheEntry; records: Record<string, unknown>[] }> => {
  const { token: nextToken, body } = await sfCall(creds, token, {
    method: 'GET',
    path: `/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(query)}`,
  });
  const parsed = SoqlResponseSchema.safeParse(body);
  if (!parsed.success) throw new VendorError(502, 'parse_error', 'soql response shape');
  return { token: nextToken, records: parsed.data.records };
};

// Per-tool input schemas. Enforced locally so we never compose a SOQL string
// or hit SF with malformed input. Validation failures become `invalid_input`.
const FindAccountArgs = z.object({ query: z.string().min(1).max(200) });
const FindContactArgs = z.object({ email: z.string().email().max(200) });
const GetOpportunityArgs = z.object({ id: z.string().regex(/^[a-zA-Z0-9]{15,18}$/) });
const UpdateOppStageArgs = z.object({
  id: z.string().regex(/^[a-zA-Z0-9]{15,18}$/),
  stage: z.string().min(1).max(200),
});
const CreateTaskArgs = z.object({
  subject: z.string().min(1).max(255),
  whatId: z.string().regex(/^[a-zA-Z0-9]{15,18}$/),
});
const DeleteTaskArgs = z.object({ id: z.string().regex(/^[a-zA-Z0-9]{15,18}$/) });

// MCP tool descriptors (what `tools/list` emits). One source of truth so the
// route handler doesn't drift from the dispatcher.
export const SALESFORCE_TOOLS = [
  {
    name: 'find_account',
    description: 'Find up to 5 Salesforce Accounts by partial Name match.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', minLength: 1 } },
    },
  },
  {
    name: 'find_contact',
    description: 'Find a Salesforce Contact by exact Email match.',
    inputSchema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
    },
  },
  {
    name: 'get_opportunity',
    description: 'Fetch a Salesforce Opportunity by 15-18 char Id.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9]{15,18}$' } },
    },
  },
  {
    name: 'update_opportunity_stage',
    description: 'Set the StageName of a Salesforce Opportunity.',
    inputSchema: {
      type: 'object',
      required: ['id', 'stage'],
      properties: { id: { type: 'string' }, stage: { type: 'string' } },
    },
  },
  {
    name: 'create_task',
    description: 'Create a Salesforce Task linked to a WhatId (Account/Opportunity).',
    inputSchema: {
      type: 'object',
      required: ['subject', 'whatId'],
      properties: { whatId: { type: 'string' }, subject: { type: 'string' } },
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a Salesforce Task by Id. Compensator for create_task on saga rollback.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9]{15,18}$' } },
    },
  },
] as const;

export const dispatchSalesforceTool = async (
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const creds = loadCredsFromEnv();
  if (!creds) throw new VendorError(500, 'credentials_missing');
  const token = await getAccessToken(creds);

  if (toolName === 'find_account') {
    const parsed = FindAccountArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const q = `SELECT Id, Name, Industry, Phone, Website FROM Account WHERE Name LIKE '%${soqlEscape(parsed.data.query)}%' LIMIT 5`;
    const { records } = await soqlQuery(creds, token, q);
    return { records };
  }

  if (toolName === 'find_contact') {
    const parsed = FindContactArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const q = `SELECT Id, Name, Email, AccountId FROM Contact WHERE Email = '${soqlEscape(parsed.data.email)}'`;
    const { records } = await soqlQuery(creds, token, q);
    return { records };
  }

  if (toolName === 'get_opportunity') {
    const parsed = GetOpportunityArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await sfCall(creds, token, {
      method: 'GET',
      path: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/${encodeURIComponent(parsed.data.id)}`,
    });
    return body;
  }

  if (toolName === 'update_opportunity_stage') {
    const parsed = UpdateOppStageArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    await sfCall(creds, token, {
      method: 'PATCH',
      path: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/${encodeURIComponent(parsed.data.id)}`,
      body: { StageName: parsed.data.stage },
    });
    return { id: parsed.data.id, success: true };
  }

  if (toolName === 'create_task') {
    const parsed = CreateTaskArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await sfCall(creds, token, {
      method: 'POST',
      path: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Task/`,
      body: {
        Subject: parsed.data.subject,
        WhatId: parsed.data.whatId,
        Status: 'Not Started',
      },
    });
    const idGuess =
      body && typeof body === 'object' && 'id' in body && typeof (body as { id?: unknown }).id === 'string'
        ? (body as { id: string }).id
        : null;
    return { id: idGuess, success: true };
  }

  if (toolName === 'delete_task') {
    const parsed = DeleteTaskArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    await sfCall(creds, token, {
      method: 'DELETE',
      path: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Task/${encodeURIComponent(parsed.data.id)}`,
    });
    return { id: parsed.data.id, success: true };
  }

  throw new VendorError(400, 'unknown_tool');
};
