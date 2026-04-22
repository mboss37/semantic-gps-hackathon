import { buildGatewayHandler, demoServerScope } from '@/lib/mcp/gateway-handler';

// Single-server gateway. Manifest narrows to one server + its tools +
// relationships limited to those tools. Useful for isolating a noisy or
// high-risk server during debugging and demo scenarios.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const makeHandle = (context: RouteContext) =>
  buildGatewayHandler(async () => {
    const { id } = await context.params;
    return demoServerScope(id);
  });

export const GET = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const POST = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const DELETE = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
