import { dispatchSalesforceTool, SALESFORCE_TOOLS } from '@/lib/mcp/vendors/salesforce';
import { handleVendorRpcRequest, type VendorRouteConfig } from '@/lib/mcp/vendors/json-rpc';

// Salesforce vendor MCP. Registered into the gateway via `POST /api/servers`
// as any other HTTP-Streamable upstream. Same-process today, standalone-deploy
// tomorrow, the gateway can't tell the difference. Governance (policies,
// audit, saga) runs at the main gateway tier before this route is even hit.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG: VendorRouteConfig = {
  protocolVersion: '2025-03-26',
  serverInfo: { name: 'semantic-gps-salesforce', version: '0.1.0' },
  tools: SALESFORCE_TOOLS,
  dispatch: dispatchSalesforceTool,
};

const handle = (request: Request): Promise<Response> => handleVendorRpcRequest(request, CONFIG);

export const GET = handle;
export const POST = handle;
