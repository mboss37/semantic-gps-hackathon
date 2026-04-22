import { buildGatewayHandler, demoOrgScope } from '@/lib/mcp/gateway-handler';

// The root gateway endpoint — org-wide scope. Stateless: every request
// rebuilds the MCP Server, connects a fresh transport, handles, disposes.
// HTTP-Streamable transport via Web Standard APIs.
// Sprint 5 note: auth lands in D.2 (Fri). Until then, scope resolves from
// the seeded demo user's membership.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = buildGatewayHandler(async () => demoOrgScope());

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
