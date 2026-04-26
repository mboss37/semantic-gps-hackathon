import { buildGatewayHandler, serverScope } from '@/lib/mcp/gateway-handler';

// Single-server gateway. Manifest narrows to one server + its tools +
// relationships limited to those tools, scoped to the token's org (WP-D.2).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const makeHandle = (context: RouteContext) =>
  buildGatewayHandler(async (_request, organizationId) => {
    const { id } = await context.params;
    return serverScope(organizationId, id);
  });

export const GET = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const POST = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const DELETE = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
