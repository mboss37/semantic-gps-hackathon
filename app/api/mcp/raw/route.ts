import { buildGatewayHandler, orgScope } from '@/lib/mcp/gateway-handler';

// Ungoverned MCP surface. Same auth stack (bearer token → org scope), same
// 12 tools from the manifest, same upstreams — but no policy enforcement, no
// relationship sidecar, no semantic rewriting, no TRel extensions, no
// execute_route orchestration. Powers the Playground A/B hero: the only
// variable between the two panes is the URL, which is the whole point.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = buildGatewayHandler(orgScope, { governed: false });

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
