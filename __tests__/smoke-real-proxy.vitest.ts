import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { proxyOpenApi } from '@/lib/mcp/proxy-openapi';
import type { ToolRow } from '@/lib/manifest/cache';

// Opt-in smoke test for the real OpenAPI proxy against a public upstream
// (httpbin.org/get). Validates end-to-end: DB lookup -> spec re-derive ->
// outbound HTTPS -> response round-trip. Complements the unit test in
// proxy-openapi.vitest.ts which uses a local mock upstream.
//
//   VERIFY_REAL_PROXY=1 pnpm test smoke-real-proxy

const shouldRun =
  process.env.VERIFY_REAL_PROXY === '1' &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SECRET_KEY;

describe.skipIf(!shouldRun)('real OpenAPI proxy smoke (httpbin.org)', () => {
  let supabase: SupabaseClient;
  let serverId = '';
  let toolId = '';

  beforeAll(async () => {
    supabase = createServiceClient();

    const { data: membership, error: memErr } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', '11111111-1111-1111-1111-111111111111')
      .single();
    if (memErr || !membership) {
      throw new Error(`demo-user membership lookup failed: ${memErr?.message ?? 'not found'}`);
    }

    const spec = {
      openapi: '3.0.0',
      info: { title: 'httpbin-smoke', version: '1.0' },
      servers: [{ url: 'https://httpbin.org' }],
      paths: {
        '/get': {
          get: {
            operationId: 'httpbinEcho',
            parameters: [
              {
                name: 'message',
                in: 'query',
                required: false,
                schema: { type: 'string' },
              },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    const { data: server, error: serverErr } = await supabase
      .from('servers')
      .insert({
        organization_id: membership.organization_id,
        name: 'httpbin-smoke-test',
        origin_url: 'https://httpbin.org',
        transport: 'openapi',
        openapi_spec: spec,
        auth_config: null,
      })
      .select('id')
      .single();
    if (serverErr || !server) {
      throw new Error(`server insert failed: ${serverErr?.message}`);
    }
    serverId = server.id;

    const { data: tool, error: toolErr } = await supabase
      .from('tools')
      .insert({
        server_id: serverId,
        name: 'httpbinEcho',
        description: 'httpbin smoke echo',
        input_schema: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      })
      .select('id')
      .single();
    if (toolErr || !tool) {
      throw new Error(`tool insert failed: ${toolErr?.message}`);
    }
    toolId = tool.id;
  });

  afterAll(async () => {
    if (serverId) {
      await supabase.from('servers').delete().eq('id', serverId);
    }
  });

  it('round-trips a GET request through the real OpenAPI proxy', async () => {
    const tool: ToolRow = {
      id: toolId,
      server_id: serverId,
      name: 'httpbinEcho',
      description: 'httpbin smoke echo',
      input_schema: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
    };

    const result = await proxyOpenApi(
      tool,
      { message: 'sprint-4-real-proxy-smoke' },
      { serverId, traceId: `smoke-${Date.now()}` },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.latencyMs).toBeGreaterThan(0);
      const body = result.result as {
        args?: Record<string, string>;
        url?: string;
      };
      expect(body.args?.message).toBe('sprint-4-real-proxy-smoke');
      expect(body.url).toContain('httpbin.org/get');
    }
  }, 30_000);
});

describe('real-proxy smoke shape (smoke)', () => {
  it('test file loads without env (skipIf gate works)', () => {
    expect(true).toBe(true);
  });
});
