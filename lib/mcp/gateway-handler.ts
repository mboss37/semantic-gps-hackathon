import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { ManifestScope } from '@/lib/manifest/cache';
import { createStatelessServer } from '@/lib/mcp/stateless-server';
import { createServiceClient } from '@/lib/supabase/service';

// Shared request plumbing for the three scoped gateway routes. Each route
// wraps the handler with a scope builder — the plumbing (trace-id, transport,
// header/IP extraction, lifecycle) lives here so route files stay ~10 lines.

// Sprint 5 has no gateway auth yet (D.2 Fri will add it). The demo user's
// membership is the only org we resolve from today. Hosted with no seed
// returns null → routes fall back to an empty-scope placeholder and log.
const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';

export const resolveDemoOrganizationId = async (): Promise<string | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return null;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', DEMO_USER_ID)
    .maybeSingle();
  if (error || !data?.organization_id) {
    console.warn('[gateway] demo membership not found; falling back to empty scope');
    return null;
  }
  return data.organization_id;
};

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

// Placeholder scope used when we can't resolve an org (e.g. hosted with no
// seed). The nil uuid guarantees zero rows match, so the stateless server
// serves just the builtin echo tool.
const EMPTY_ORG_SCOPE: ManifestScope = {
  kind: 'org',
  organization_id: '00000000-0000-0000-0000-000000000000',
};

export type ScopeResolver = (request: Request) => Promise<ManifestScope>;

export const buildGatewayHandler = (resolveScope: ScopeResolver) => {
  return async (request: Request): Promise<Response> => {
    const traceId = randomUUID();
    const headers = collectHeaders(request);
    const clientIp = extractClientIp(headers);
    const scope = await resolveScope(request);
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

export const demoOrgScope = async (): Promise<ManifestScope> => {
  const orgId = await resolveDemoOrganizationId();
  if (!orgId) return EMPTY_ORG_SCOPE;
  return { kind: 'org', organization_id: orgId };
};

export const demoDomainScope = async (domainSlug: string): Promise<ManifestScope> => {
  const orgId = await resolveDemoOrganizationId();
  if (!orgId) return EMPTY_ORG_SCOPE;
  return { kind: 'domain', organization_id: orgId, domain_slug: domainSlug };
};

export const demoServerScope = async (serverId: string): Promise<ManifestScope> => {
  const orgId = await resolveDemoOrganizationId();
  if (!orgId) return EMPTY_ORG_SCOPE;
  return { kind: 'server', organization_id: orgId, server_id: serverId };
};
