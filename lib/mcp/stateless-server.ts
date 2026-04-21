import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logMCPEvent } from '@/lib/audit/logger';

// Fresh McpServer per request. No in-memory session state — every invocation
// reconstructs, connects to the transport, handles one request, disposes.
// Works unchanged on Vercel Fluid Compute and any horizontal-scale target.

const SERVER_INFO = {
  name: 'semantic-gps-gateway',
  version: '0.1.0',
} as const;

type CreateServerOpts = {
  traceId: string;
};

export const createStatelessServer = ({ traceId }: CreateServerOpts): McpServer => {
  const server = new McpServer(SERVER_INFO);

  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Echoes the provided message back. Used to verify the gateway is alive.',
      inputSchema: { message: z.string().min(1).describe('Text to echo back') },
    },
    async ({ message }) => {
      const started = performance.now();
      const result = {
        content: [{ type: 'text' as const, text: message }],
      };
      logMCPEvent({
        trace_id: traceId,
        tool_name: 'echo',
        method: 'tools/call',
        status: 'ok',
        latency_ms: Math.round(performance.now() - started),
        payload: { args: { message }, result },
      });
      return result;
    },
  );

  return server;
};
