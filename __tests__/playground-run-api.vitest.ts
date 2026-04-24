import { describe, expect, it, vi, beforeEach } from 'vitest';

// WP-J.1 (refactored): Playground /api/playground/run endpoint. Both modes
// now go through Anthropic's beta mcp_servers connector — the only variable
// is the URL pointed at /api/mcp vs /api/mcp/raw. Tests verify the NDJSON
// event stream shape, the URL routing per mode, and the auth gate.

// -- Hoisted mocks -----------------------------------------------------------

const { requireAuthMock, mintTokenMock, betaCreateMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  mintTokenMock: vi.fn(),
  betaCreateMock: vi.fn(),
}));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, requireAuth: requireAuthMock };
});

// Service-client stub so the token mint path never hits a real DB.
// Sprint 17 WP-17.2: mintPlaygroundToken first SELECTs an existing kind=system
// row and reuses it if present, else INSERTs a new one. The mock defaults to
// "no existing row" (maybeSingle → null) so every test exercises the INSERT
// path unless it explicitly queues a row via mintTokenMock.
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    const selectChain = {
      eq: () => selectChain,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    return {
      from: () => ({
        select: () => selectChain,
        insert: () => ({
          select: () => ({
            single: async () => mintTokenMock(),
          }),
        }),
      }),
    };
  },
}));

vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    public beta = { messages: { create: betaCreateMock } };
  }
  return { default: FakeAnthropic };
});

// Keep the env sane so we don't bail on ANTHROPIC_API_KEY or model helpers.
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-playground';
  process.env.PLAYGROUND_MODEL = 'claude-opus-4-7';
  requireAuthMock.mockReset();
  mintTokenMock.mockReset();
  betaCreateMock.mockReset();
});

const { POST } = await import('@/app/api/playground/run/route');

// -- Helpers -----------------------------------------------------------------

type StreamEvent = {
  type: string;
  [key: string]: unknown;
  stats?: { tool_calls: number; ms: number; policy_events?: number };
};

const readNdjson = async (res: Response): Promise<StreamEvent[]> => {
  const text = await res.text();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StreamEvent);
};

const post = async (body: unknown): Promise<Response> =>
  POST(
    new Request('http://localhost/api/playground/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

// -- Tests -------------------------------------------------------------------

describe('POST /api/playground/run', () => {
  it('bails with 401 when the user is not authenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());
    const res = await post({ prompt: 'hi', mode: 'raw' });
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('unauthorized');
  });

  it('returns 400 on a malformed body', async () => {
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-1',
      role: 'admin',
      supabase: {},
    });
    const res = await post({ prompt: '', mode: 'raw' });
    expect(res.status).toBe(400);
  });

  it('streams raw-mode NDJSON: mints a token and points the MCP connector at /api/mcp/raw', async () => {
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-1',
      role: 'admin',
      supabase: {},
    });
    mintTokenMock.mockResolvedValueOnce({
      data: { id: 'tok-raw' },
      error: null,
    });
    betaCreateMock.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'mcp_tool_use',
          id: 'mcp-r1',
          name: 'find_contact',
          input: { email: 'sarah@edge.com' },
          server_name: 'semantic-gps',
        },
        {
          type: 'mcp_tool_result',
          tool_use_id: 'mcp-r1',
          content: [{ type: 'text', text: '{"records":[{"Id":"003XX"}]}' }],
          is_error: false,
        },
        { type: 'text', text: 'Found Sarah.' },
      ],
    });

    const res = await post({ prompt: 'find sarah', mode: 'raw' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/ndjson/);

    const events = await readNdjson(res);
    const types = events.map((e) => e.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('text');
    expect(types[types.length - 1]).toBe('done');

    const toolCall = events.find((e) => e.type === 'tool_call');
    expect(toolCall?.name).toBe('find_contact');

    const done = events[events.length - 1] as {
      stats: { tool_calls: number; ms: number; policy_events?: number };
    };
    expect(done.stats.tool_calls).toBe(1);
    // Raw mode reports policy_events = 0 by definition — the observable
    // contrast vs governed.
    expect(done.stats.policy_events).toBe(0);

    // Both modes use the beta MCP connector; raw mode points at /api/mcp/raw.
    expect(betaCreateMock).toHaveBeenCalledTimes(1);
    const callArgs = betaCreateMock.mock.calls[0][0] as {
      mcp_servers: Array<{ authorization_token?: string; url: string }>;
      tools: Array<{ type: string; mcp_server_name: string }>;
    };
    expect(callArgs.mcp_servers[0].url).toMatch(/\/api\/mcp\/raw$/);
    expect(callArgs.mcp_servers[0].authorization_token).toMatch(/^sgps_/);
    expect(callArgs.tools[0].type).toBe('mcp_toolset');
  });

  it('streams gateway-mode NDJSON: mints a token and points the MCP connector at /api/mcp', async () => {
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-2',
      role: 'admin',
      supabase: {},
    });
    mintTokenMock.mockResolvedValueOnce({
      data: { id: 'tok-1' },
      error: null,
    });
    betaCreateMock.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'mcp_tool_use',
          id: 'mcp-1',
          name: 'find_account',
          input: { query: 'Edge' },
          server_name: 'semantic-gps',
        },
        {
          type: 'mcp_tool_result',
          tool_use_id: 'mcp-1',
          content: [{ type: 'text', text: '{"records":[{"Id":"001XX"}]}' }],
          is_error: false,
        },
        { type: 'text', text: 'Done.' },
      ],
    });

    const res = await post({ prompt: 'find edge', mode: 'gateway' });
    expect(res.status).toBe(200);
    const events = await readNdjson(res);

    expect(events.some((e) => e.type === 'tool_call' && e.name === 'find_account')).toBe(true);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    const done = events.at(-1) as {
      stats: { tool_calls: number; policy_events?: number };
    };
    expect(done.stats.policy_events).toBe(0);

    expect(mintTokenMock).toHaveBeenCalledTimes(1);
    expect(betaCreateMock).toHaveBeenCalledTimes(1);
    const callArgs = betaCreateMock.mock.calls[0][0] as {
      mcp_servers: Array<{ authorization_token?: string; url: string }>;
    };
    expect(callArgs.mcp_servers[0].authorization_token).toMatch(/^sgps_/);
    // Governed mode hits /api/mcp (not /api/mcp/raw) — anchor so raw doesn't
    // accidentally match.
    expect(callArgs.mcp_servers[0].url).toMatch(/\/api\/mcp$/);
    expect(callArgs.mcp_servers[0].url).not.toMatch(/\/api\/mcp\/raw$/);
  });

  it('streams thinking blocks as their own event type + accumulates thinking_chars in stats', async () => {
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-think',
      role: 'admin',
      supabase: {},
    });
    mintTokenMock.mockResolvedValueOnce({
      data: { id: 'tok-think' },
      error: null,
    });
    // Extended thinking returns blocks interleaved with text/tool_use.
    // Shape: { type: 'thinking', thinking: string, signature: string }.
    betaCreateMock.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'thinking',
          thinking: 'User wants Edge Communications account. find_account first.',
          signature: 'sig-a',
        },
        {
          type: 'mcp_tool_use',
          id: 'mcp-1',
          name: 'find_account',
          input: { query: 'Edge Communications' },
          server_name: 'semantic-gps',
        },
        {
          type: 'mcp_tool_result',
          tool_use_id: 'mcp-1',
          content: [{ type: 'text', text: '{"records":[{"Id":"001XX"}]}' }],
          is_error: false,
        },
        {
          type: 'thinking',
          thinking: 'Got the account. Now post a Slack heads-up.',
          signature: 'sig-b',
        },
        { type: 'text', text: 'Done.' },
      ],
    });
    // Also verify the thinking parameter is sent on the request.
    const res = await post({ prompt: 'edge follow-up', mode: 'gateway' });
    expect(res.status).toBe(200);

    const events = await readNdjson(res);
    const thinkingEvents = events.filter((e) => e.type === 'thinking');
    expect(thinkingEvents).toHaveLength(2);
    expect(thinkingEvents[0].content).toMatch(/find_account first/);
    expect(thinkingEvents[1].content).toMatch(/Slack/);

    const done = events.at(-1) as {
      stats: { thinking_chars?: number; tool_calls: number };
    };
    expect(done.stats.thinking_chars).toBeGreaterThan(0);
    expect(done.stats.thinking_chars).toBe(
      (thinkingEvents[0].content as string).length + (thinkingEvents[1].content as string).length,
    );

    // Request param sanity — thinking must be enabled on the call.
    const callArgs = betaCreateMock.mock.calls[0][0] as {
      thinking?: { type: string; budget_tokens: number };
      max_tokens: number;
    };
    expect(callArgs.thinking?.type).toBe('enabled');
    expect(callArgs.thinking?.budget_tokens).toBeGreaterThan(0);
    // max_tokens must exceed budget_tokens so final text + tools have room.
    expect(callArgs.max_tokens).toBeGreaterThan(callArgs.thinking?.budget_tokens ?? 0);
  });

  it('emits an error event when mode cannot mint a token', async () => {
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-3',
      role: 'admin',
      supabase: {},
    });
    mintTokenMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'unique_violation' },
    });

    const res = await post({ prompt: 'scenario', mode: 'gateway' });
    expect(res.status).toBe(200);
    const events = await readNdjson(res);
    expect(events.some((e) => e.type === 'error' && /mint/i.test(String(e.message)))).toBe(true);
    expect(events.at(-1)?.type).toBe('done');
    expect(betaCreateMock).not.toHaveBeenCalled();
  });
});
