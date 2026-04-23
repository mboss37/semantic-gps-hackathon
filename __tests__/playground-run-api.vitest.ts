import { describe, expect, it, vi, beforeEach } from 'vitest';

// WP-J.1: Playground /api/playground/run endpoint. Verifies the NDJSON event
// stream shape for both modes and that the auth gate blocks unauthenticated
// callers.

// -- Hoisted mocks -----------------------------------------------------------

const { requireAuthMock, mintTokenMock, standardCreateMock, betaCreateMock, dispatchRawToolMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    mintTokenMock: vi.fn(),
    standardCreateMock: vi.fn(),
    betaCreateMock: vi.fn(),
    dispatchRawToolMock: vi.fn(),
  }));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, requireAuth: requireAuthMock };
});

// Service-client stub so the token mint path never hits a real DB.
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => mintTokenMock(),
        }),
      }),
    }),
  }),
}));

// Raw-dispatch stub — real proxies hit SF/Slack/GitHub; the test just
// asserts event-shape plumbing, so a canned {content, is_error} pair is
// enough. Defaults to a benign response; individual tests can override.
vi.mock('@/lib/playground/raw-dispatch', async () => {
  const actual = await vi.importActual<typeof import('@/lib/playground/raw-dispatch')>(
    '@/lib/playground/raw-dispatch',
  );
  return { ...actual, dispatchRawTool: dispatchRawToolMock };
});

vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    public messages = { create: standardCreateMock };
    public beta = { messages: { create: betaCreateMock } };
  }
  return { default: FakeAnthropic };
});

// Keep the env sane so we don't bail on ANTHROPIC_API_KEY.
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-playground';
  requireAuthMock.mockReset();
  mintTokenMock.mockReset();
  standardCreateMock.mockReset();
  betaCreateMock.mockReset();
  dispatchRawToolMock.mockReset();
  dispatchRawToolMock.mockResolvedValue({
    content: '{"records":[{"Id":"003XXBOGUS001","Email":"sarah@edge.com"}]}',
    is_error: false,
  });
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

  it('streams raw-mode NDJSON: tool_call, tool_result, text, done', async () => {
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-1',
      role: 'admin',
      supabase: {},
    });
    // First turn returns a tool_use; second turn stops with text.
    standardCreateMock
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'find_contact',
            input: { email: 'sarah@edge.com' },
          },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Found Sarah at Edge.' }],
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
    // raw mode never emits policy_events, so the stats field stays absent.
    expect(done.stats.policy_events).toBeUndefined();
    // Gateway path must not have been taken.
    expect(betaCreateMock).not.toHaveBeenCalled();
  });

  it('streams gateway-mode NDJSON: mints a token and surfaces mcp_tool_use / mcp_tool_result', async () => {
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
    // gateway mode always reports policy_events (even when zero).
    expect(done.stats.policy_events).toBe(0);

    // Verify the mint happened and the Anthropic call threaded the token.
    expect(mintTokenMock).toHaveBeenCalledTimes(1);
    expect(betaCreateMock).toHaveBeenCalledTimes(1);
    const callArgs = betaCreateMock.mock.calls[0][0] as {
      mcp_servers: Array<{ authorization_token?: string; url: string }>;
    };
    expect(callArgs.mcp_servers[0].authorization_token).toMatch(/^sgps_/);
    expect(callArgs.mcp_servers[0].url).toMatch(/\/api\/mcp$/);
    // And the raw path stayed untouched.
    expect(standardCreateMock).not.toHaveBeenCalled();
  });

  it('emits an error event when gateway mode cannot mint a token', async () => {
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
