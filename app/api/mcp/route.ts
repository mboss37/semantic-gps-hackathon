import { buildGatewayHandler, orgScope } from '@/lib/mcp/gateway-handler';

// Root gateway endpoint, org-wide scope. Stateless: every request rebuilds
// the MCP Server, connects a fresh transport, handles, disposes.
// HTTP-Streamable transport via Web Standard APIs. Bearer-token auth
// resolves the calling org before the manifest loads (WP-D.2).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = buildGatewayHandler(orgScope);

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
