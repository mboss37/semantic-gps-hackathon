import { buildGatewayHandler, demoDomainScope } from '@/lib/mcp/gateway-handler';

// Domain-scoped gateway. Manifest is filtered to servers whose `domain_id`
// matches the given slug. Auth arrives in D.2 — today the demo user's org
// is the implicit scope.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

const makeHandle = (context: RouteContext) =>
  buildGatewayHandler(async () => {
    const { slug } = await context.params;
    return demoDomainScope(slug);
  });

export const GET = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const POST = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const DELETE = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
