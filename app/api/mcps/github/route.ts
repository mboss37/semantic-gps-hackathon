import { dispatchGithubTool, GITHUB_TOOLS } from '@/lib/mcp/vendors/github';
import { handleVendorRpcRequest, type VendorRouteConfig } from '@/lib/mcp/vendors/json-rpc';

// GitHub vendor MCP. See `app/api/mcps/salesforce/route.ts` for the full
// architectural rationale, this is the same shape with a GitHub tool catalog.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG: VendorRouteConfig = {
  protocolVersion: '2025-03-26',
  serverInfo: { name: 'semantic-gps-github', version: '0.1.0' },
  tools: GITHUB_TOOLS,
  dispatch: dispatchGithubTool,
};

const handle = (request: Request): Promise<Response> => handleVendorRpcRequest(request, CONFIG);

export const GET = handle;
export const POST = handle;
