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

const unauthorizedResponse = (): Response =>
  new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'unauthorized' },
      id: null,
    }),
    {
      status: 401,
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
      return unauthorizedResponse();
    }

    const supabase = createServiceClient();
    const tokenRow = await resolveOrgFromToken(supabase, token);
    if (!tokenRow) {
      logMCPEvent({ trace_id: traceId, method: 'auth', status: 'unauthorized' });
      return unauthorizedResponse();
    }

    // WP-G.4: expose the authenticated org id to policy runners. rate_limit
    // keys identity on `x-org-id` > `client_ip` > 'anon'. Sourced from the
    // resolved gateway token (D.2), not the scope builder — every scope tier
    // (org/domain/server) sees the same caller identity.
    headers['x-org-id'] = tokenRow.organization_id;

    const scope = await resolveScope(request, tokenRow.organization_id);
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
