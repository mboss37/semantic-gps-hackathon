import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createStatelessServer } from '@/lib/mcp/stateless-server';

// The gateway endpoint. Stateless: every request rebuilds the MCP Server,
// connects to a fresh transport, handles the request, disposes.
// HTTP-Streamable transport via Web Standard APIs — works in any runtime
// that speaks Request/Response (Next.js App Router, Cloudflare Workers, Bun).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = async (request: Request): Promise<Response> => {
  const traceId = randomUUID();
  const server = createStatelessServer({ traceId });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await server.close().catch(() => {});
  }
};

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
