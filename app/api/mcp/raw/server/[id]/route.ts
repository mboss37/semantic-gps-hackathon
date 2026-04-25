import { buildGatewayHandler, serverScope } from '@/lib/mcp/gateway-handler';

// Server-scoped ungoverned MCP surface — mirror of `/api/mcp/raw` but
// narrowed to a single server's manifest. Powers the Playground's "scope:
// server" mode so the Raw vs Gateway A/B compares apples to apples (same
// server, same tools, same auth) — only governance differs.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const makeHandle = (context: RouteContext) =>
  buildGatewayHandler(
    async (_request, organizationId) => {
      const { id } = await context.params;
      return serverScope(organizationId, id);
    },
    { governed: false },
  );

export const GET = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const POST = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const DELETE = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
