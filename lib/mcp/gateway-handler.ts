import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { logMCPEvent } from '@/lib/audit/logger';
import type { ManifestScope } from '@/lib/manifest/cache';
import { parseBearer, resolveOrgFromToken } from '@/lib/mcp/auth-token';
import { createStatelessServer } from '@/lib/mcp/stateless-server';
import { createServiceClient } from '@/lib/supabase/service';

// Shared request plumbing for the three scoped gateway routes. Each route
// wraps the handler with a scope builder — the plumbing (trace-id, transport,
// header/IP extraction, bearer auth, lifecycle) lives here so route files
// stay ~10 lines.

const extractClientIp = (headers: Record<string, string>): string | undefined => {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers['x-real-ip'];
};

const collectHeaders = (request: Request): Record<string, string> => {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};

// JSON-RPC error envelope that tells the client exactly what went wrong.
// `reason` is a stable machine-readable tag; `message` is human. Never puts
// secrets or stack traces in `data` — only tagged categories.
type ErrorKind =
  | { status: 401; code: number; reason: 'missing_authorization'; message: string }
  | { status: 401; code: number; reason: 'invalid_token'; message: string }
  | { status: 500; code: number; reason: 'server_misconfigured'; message: string; detail?: string }
  | { status: 502; code: number; reason: 'upstream_db_error'; message: string; detail?: string };

const errorResponse = (kind: ErrorKind): Response =>
  new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: kind.code,
        message: kind.message,
        data: {
          reason: kind.reason,
          ...('detail' in kind && kind.detail ? { detail: kind.detail } : {}),
        },
      },
      id: null,
    }),
    {
      status: kind.status,
      headers: { 'content-type': 'application/json' },
    },
  );

// Scope resolver receives the authenticated org id so every builder shapes
// the manifest around the caller's tenant. Route-specific bits (slug, id)
// still come from the Request.
export type ScopeResolver = (
  request: Request,
  organizationId: string,
) => Promise<ManifestScope>;

export const buildGatewayHandler = (resolveScope: ScopeResolver) => {
  return async (request: Request): Promise<Response> => {
    const traceId = randomUUID();
    const headers = collectHeaders(request);
    const clientIp = extractClientIp(headers);

    const token = parseBearer(headers['authorization']);
    if (!token) {
      logMCPEvent({ trace_id: traceId, method: 'auth', status: 'unauthorized' });
      return errorResponse({
        status: 401,
        code: -32001,
        reason: 'missing_authorization',
        message: 'Missing or malformed Authorization header. Expected: Authorization: Bearer <token>.',
      });
    }

    // Service client throws when Supabase env is missing (see service.ts).
    // Catching here so Postman sees a JSON body instead of an HTML 500.
    let tokenResult;
    try {
      const supabase = createServiceClient();
      tokenResult = await resolveOrgFromToken(supabase, token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logMCPEvent({
        trace_id: traceId,
        method: 'auth',
        status: 'origin_error',
        payload: { reason: 'server_misconfigured', detail: msg },
      });
      return errorResponse({
        status: 500,
        code: -32603,
        reason: 'server_misconfigured',
        message: 'Gateway Supabase client failed to initialize. Check SUPABASE_SECRET_KEY + NEXT_PUBLIC_SUPABASE_URL on the deployment.',
        detail: msg,
      });
    }

    if (!tokenResult.ok && tokenResult.reason === 'db_error') {
      logMCPEvent({
        trace_id: traceId,
        method: 'auth',
        status: 'origin_error',
        payload: { reason: 'upstream_db_error', detail: tokenResult.detail },
      });
      return errorResponse({
        status: 502,
        code: -32603,
        reason: 'upstream_db_error',
        message: 'Gateway could not reach Supabase to validate the token. Check SUPABASE_SECRET_KEY matches the project at NEXT_PUBLIC_SUPABASE_URL.',
        detail: tokenResult.detail,
      });
    }

    if (!tokenResult.ok) {
      logMCPEvent({ trace_id: traceId, method: 'auth', status: 'unauthorized' });
      return errorResponse({
        status: 401,
        code: -32001,
        reason: 'invalid_token',
        message: 'Bearer token is not recognized by this gateway. The token exists in the request but no matching row was found in gateway_tokens.',
      });
    }

    // WP-G.4: expose the authenticated org id to policy runners. rate_limit
    // keys identity on `x-org-id` > `client_ip` > 'anon'. Sourced from the
    // resolved gateway token (D.2), not the scope builder — every scope tier
    // (org/domain/server) sees the same caller identity.
    headers['x-org-id'] = tokenResult.organization_id;

    const scope = await resolveScope(request, tokenResult.organization_id);
    const server = createStatelessServer({ traceId, scope, headers, clientIp });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      return await transport.handleRequest(request);
    } finally {
      await server.close().catch(() => {});
    }
  };
};

export const orgScope = async (
  _request: Request,
  organizationId: string,
): Promise<ManifestScope> => ({ kind: 'org', organization_id: organizationId });

export const domainScope = async (
  organizationId: string,
  domainSlug: string,
): Promise<ManifestScope> => ({
  kind: 'domain',
  organization_id: organizationId,
  domain_slug: domainSlug,
});

export const serverScope = async (
  organizationId: string,
  serverId: string,
): Promise<ManifestScope> => ({
  kind: 'server',
  organization_id: organizationId,
  server_id: serverId,
});
