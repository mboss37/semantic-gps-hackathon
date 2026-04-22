import { buildGatewayHandler, domainScope } from '@/lib/mcp/gateway-handler';

// Domain-scoped gateway. Manifest is filtered to servers whose `domain_id`
// matches the given slug, scoped to the token's org (WP-D.2).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

const makeHandle = (context: RouteContext) =>
  buildGatewayHandler(async (_request, organizationId) => {
    const { slug } = await context.params;
    return domainScope(organizationId, slug);
  });

export const GET = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const POST = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
export const DELETE = async (request: Request, context: RouteContext) =>
  makeHandle(context)(request);
