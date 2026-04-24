import { dispatchSlackTool, SLACK_TOOLS } from '@/lib/mcp/vendors/slack';
import { handleVendorRpcRequest, type VendorRouteConfig } from '@/lib/mcp/vendors/json-rpc';

// Slack vendor MCP. See `app/api/mcps/salesforce/route.ts` for the full
// architectural rationale — this is the same shape with a Slack tool catalog.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG: VendorRouteConfig = {
  protocolVersion: '2025-03-26',
  serverInfo: { name: 'semantic-gps-slack', version: '0.1.0' },
  tools: SLACK_TOOLS,
  dispatch: dispatchSlackTool,
};

const handle = (request: Request): Promise<Response> => handleVendorRpcRequest(request, CONFIG);

export const GET = handle;
export const POST = handle;
