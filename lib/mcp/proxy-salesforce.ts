import { z } from 'zod';
import type { ToolRow } from '@/lib/manifest/cache';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import {
  decodeAuthConfig,
  getAccessToken,
  invalidateToken,
  loadServer,
  TIMEOUT_MS,
  UpstreamError,
  type SalesforceAuthConfig,
  type TokenCacheEntry,
} from '@/lib/mcp/salesforce-auth';

// Re-export auth-seam surface so external callers (tool-dispatcher, tests,
// register-salesforce) keep a single import path.
export {
  __resetSalesforceTokenCacheForTests,
  type SalesforceAuthConfig,
} from '@/lib/mcp/salesforce-auth';

// Hero Salesforce proxy — hand-authored mapping from 5 curated MCP tools onto
// SOQL + REST SObject endpoints. OAuth + token cache live in
// `./salesforce-auth.ts`; this file is just the call path + tool dispatch.
// Same ProxyResult contract as proxy-openapi / proxy-http so the dispatcher
// switch routes without special casing.

const RETRY_BACKOFF_MS = 200;
const SALESFORCE_API_VERSION = 'v60.0';

export type ProxyOk = { ok: true; result: unknown; latencyMs: number };
export type ProxyErr = { ok: false; error: string; status?: number };
export type ProxyResult = ProxyOk | ProxyErr;

export type ProxyContext = {
  serverId: string;
  traceId: string;
};

const SoqlResponseSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())),
});

const SalesforceErrorArray = z.array(
  z.object({
    message: z.string().optional(),
    errorCode: z.string().optional(),
  }),
);

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// SOQL single-quote escape. `'` and `\` are the two breakout chars per
// Salesforce docs. id/email formats are validated separately before we ever
// compose a SOQL string.
export const soqlEscape = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

type CallInit = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
};

// Generic Salesforce REST call with 401 single-retry (refresh token) and 5xx
// single-retry. Returns `null` body on 204 No Content (PATCH + DELETE responses).
const sfCall = async (
  serverId: string,
  auth: SalesforceAuthConfig,
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
      invalidateToken(serverId);
      currentToken = await getAccessToken(serverId, auth, true);
      headers.authorization = `Bearer ${currentToken.access_token}`;
      res = await attempt();
    }
    // 5xx single-retry with small backoff. No jitter — a second 5xx falls
    // through to the non-ok handler below, which classifies as origin_error.
    if (res.status >= 500 && res.status < 600) {
      await res.text().catch(() => '');
      await delay(RETRY_BACKOFF_MS);
      res = await attempt();
    }
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    throw new UpstreamError(502, 'network_error');
  }

  const text = await res.text();

  if (res.status === 401) {
    throw new UpstreamError(401, 'upstream_auth_failed');
  }

  if (!res.ok) {
    let detail: string | undefined;
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        const arr = SalesforceErrorArray.safeParse(parsed);
        if (arr.success && arr.data.length > 0) {
          detail = arr.data[0].message;
        } else if (parsed && typeof parsed === 'object' && 'message' in parsed) {
          const msg = (parsed as { message?: unknown }).message;
          if (typeof msg === 'string') detail = msg;
        }
      } catch {
        // non-json body, ignore
      }
    }
    throw new UpstreamError(res.status, 'origin_error', detail);
  }

  if (!text) return { token: currentToken, body: null };
  try {
    return { token: currentToken, body: JSON.parse(text) };
  } catch {
    throw new UpstreamError(502, 'parse_error');
  }
};

const soqlQuery = async (
  serverId: string,
  auth: SalesforceAuthConfig,
  token: TokenCacheEntry,
  query: string,
): Promise<{ token: TokenCacheEntry; records: Record<string, unknown>[] }> => {
  const { token: nextToken, body } = await sfCall(serverId, auth, token, {
    method: 'GET',
    path: `/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(query)}`,
  });
  const parsed = SoqlResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new UpstreamError(502, 'parse_error', 'soql response shape');
  }
  return { token: nextToken, records: parsed.data.records };
};

// Per-tool input schemas. Enforced locally so we never compose a SOQL string
// or hit Salesforce with malformed input. Errors here become `invalid_input`.
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
// Compensator for create_task (WP-12.2 / G.17). Salesforce SObject DELETE
// returns 204 No Content — sfCall's `!text` branch already yields body: null,
// so we synthesise the result shape from the validated id.
const DeleteTaskArgs = z.object({
  id: z.string().regex(/^[a-zA-Z0-9]{15,18}$/),
});

const dispatchTool = async (
  serverId: string,
  auth: SalesforceAuthConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const token = await getAccessToken(serverId, auth);

  if (toolName === 'find_account') {
    const parsed = FindAccountArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const q = `SELECT Id, Name, Industry, Phone, Website FROM Account WHERE Name LIKE '%${soqlEscape(parsed.data.query)}%' LIMIT 5`;
    const { records } = await soqlQuery(serverId, auth, token, q);
    return { records };
  }

  if (toolName === 'find_contact') {
    const parsed = FindContactArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const q = `SELECT Id, Name, Email, AccountId FROM Contact WHERE Email = '${soqlEscape(parsed.data.email)}'`;
    const { records } = await soqlQuery(serverId, auth, token, q);
    return { records };
  }

  if (toolName === 'get_opportunity') {
    const parsed = GetOpportunityArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await sfCall(serverId, auth, token, {
      method: 'GET',
      path: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/${encodeURIComponent(parsed.data.id)}`,
    });
    return body;
  }

  if (toolName === 'update_opportunity_stage') {
    const parsed = UpdateOppStageArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    await sfCall(serverId, auth, token, {
      method: 'PATCH',
      path: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/${encodeURIComponent(parsed.data.id)}`,
      body: { StageName: parsed.data.stage },
    });
    return { id: parsed.data.id, success: true };
  }

  if (toolName === 'create_task') {
    const parsed = CreateTaskArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await sfCall(serverId, auth, token, {
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
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    await sfCall(serverId, auth, token, {
      method: 'DELETE',
      path: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Task/${encodeURIComponent(parsed.data.id)}`,
    });
    return { id: parsed.data.id, success: true };
  }

  throw new UpstreamError(400, 'unknown_tool');
};

// Public entry point for `tool-dispatcher.ts`. Same `ProxyResult` contract as
// the OpenAPI + HTTP-streamable proxies so the dispatcher transport switch
// stays uniform.
export const proxySalesforce = async (
  tool: ToolRow,
  args: Record<string, unknown>,
  ctx: ProxyContext,
): Promise<ProxyResult> => {
  const started = performance.now();

  const server = await loadServer(ctx.serverId);
  if (!server) return { ok: false, error: 'server_not_found' };
  if (server.transport !== 'salesforce') return { ok: false, error: 'wrong_transport' };

  let auth: SalesforceAuthConfig | null;
  try {
    auth = decodeAuthConfig(server.auth_config);
  } catch {
    return { ok: false, error: 'auth_decode_failed' };
  }
  if (!auth) return { ok: false, error: 'auth_decode_failed' };

  try {
    const result = await dispatchTool(ctx.serverId, auth, tool.name, args);
    const latencyMs = Math.round(performance.now() - started);
    return { ok: true, result, latencyMs };
  } catch (e) {
    if (e instanceof SsrfBlockedError) return { ok: false, error: 'ssrf_blocked' };
    if (e instanceof UpstreamError) {
      return { ok: false, error: e.reason, status: e.status };
    }
    return { ok: false, error: 'network_error' };
  }
};
