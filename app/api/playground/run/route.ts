import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { modelPlayground } from '@/lib/config/models';
import { mintPlaygroundToken } from '@/lib/mcp/playground-token';
import { reservePlaygroundSlot } from '@/lib/playground/rate-limit';

// Playground A/B run endpoint. Both panes use Anthropic's beta `mcp_servers`
// connector so the only variable between them is the URL, `raw` hits the
// ungoverned surface, `gateway` hits the full Semantic GPS control plane.
// Output is newline-delimited JSON streamed live: thinking + text + tool calls
// + tool results + per-tool latency arrive incrementally as the model
// generates them.
//
// Body params:
//   prompt  , user prompt
//   mode    , 'raw' | 'gateway' (which surface to hit)
//   scope   , 'org' | 'server' (default 'org'); 'domain' will land once
//              domain CRUD ships
//   serverId, uuid, required when scope='server'
//
// The bearer is always the auto-managed system token (`mintPlaygroundToken`).
// The Playground is plumbing, token management lives on `/dashboard/tokens`.
//
// trace_id model: the route mints one uuid per Run and threads it to the
// gateway via `?trace_id=<uuid>`. Every internal MCP call from this Run
// (tools/list + N tools/call) shares that trace_id, so the audit page can
// surface the entire run with the existing trace_id filter.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Extended duration, Opus + multi-step MCP roundtrips can run 20–60s.
export const maxDuration = 120;

const RunBody = z.object({
  prompt: z.string().min(1).max(4000),
  mode: z.enum(['raw', 'gateway']),
  scope: z.enum(['org', 'server']).default('org'),
  serverId: z.string().uuid().optional(),
});

type StreamEvent =
  | { type: 'tool_call'; id: string; name: string; args_preview: string }
  | { type: 'tool_result'; id: string; summary: string; is_error?: boolean; ms?: number }
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'policy_event'; detail: string }
  | { type: 'error'; message: string }
  | {
      type: 'done';
      stats: {
        tool_calls: number;
        ms: number;
        policy_events?: number;
        thinking_chars?: number;
        trace_id: string;
      };
    };

const argsPreview = (input: unknown): string => {
  try {
    const text = JSON.stringify(input);
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  } catch {
    return '[unserializable args]';
  }
};

const summarize = (payload: unknown): string => {
  if (payload === null || payload === undefined) return '(no result)';
  if (typeof payload === 'string') {
    return payload.length > 200 ? `${payload.slice(0, 197)}…` : payload;
  }
  try {
    const text = JSON.stringify(payload);
    return text.length > 200 ? `${text.slice(0, 197)}…` : text;
  } catch {
    return '[unsummarizable]';
  }
};

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Resolve the public origin for in-process MCP calls. Production sets
// SEMANTIC_GPS_GATEWAY_URL or NEXT_PUBLIC_APP_URL; localhost falls back to
// the deployed Vercel URL because the Anthropic MCP connector cannot reach
// localhost itself.
const baseOrigin = (): string => {
  const explicit = process.env.SEMANTIC_GPS_GATEWAY_URL;
  if (explicit) return explicit.replace(/\/api\/mcp.*$/, '').replace(/\/$/, '');
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app && !app.includes('localhost')) return app.replace(/\/$/, '');
  return 'https://semantic-gps-hackathon.vercel.app';
};

const buildMcpUrl = (input: {
  mode: 'raw' | 'gateway';
  scope: 'org' | 'server';
  serverId?: string;
  traceId: string;
}): string => {
  const origin = baseOrigin();
  const rawSegment = input.mode === 'raw' ? '/raw' : '';
  const path =
    input.scope === 'server' && input.serverId
      ? `${origin}/api/mcp${rawSegment}/server/${input.serverId}`
      : `${origin}/api/mcp${rawSegment}`;
  // `trace_id` flows through the gateway-handler URL parser; every
  // `mcp_events` row this run produces shares it, so the audit page can
  // filter the whole run with the existing trace_id input.
  return `${path}?trace_id=${input.traceId}`;
};

const runWithMcp = async (
  anthropic: Anthropic,
  prompt: string,
  url: string,
  bearerToken: string,
  emit: (event: StreamEvent) => void,
): Promise<void> => {
  const stream = anthropic.beta.messages.stream({
    model: modelPlayground(),
    max_tokens: 8192,
    thinking: { type: 'enabled', budget_tokens: 2048 },
    betas: ['mcp-client-2025-11-20'],
    mcp_servers: [
      {
        name: 'semantic-gps',
        type: 'url',
        url,
        authorization_token: bearerToken,
      },
    ],
    tools: [{ type: 'mcp_toolset', mcp_server_name: 'semantic-gps' }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Per-tool latency: timestamp on mcp_tool_use start, elapsed on the matching
  // mcp_tool_result. Captures wall-clock time the model perceives the tool
  // taking, Anthropic dispatch + our gateway + upstream + round-trip.
  const toolStartedAt = new Map<string, number>();
  const emittedToolResultIds = new Set<string>();

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (block.type === 'mcp_tool_use') {
        toolStartedAt.set(block.id, performance.now());
        emit({
          type: 'tool_call',
          id: block.id,
          name: block.name,
          args_preview: argsPreview(block.input),
        });
      } else if (block.type === 'mcp_tool_result') {
        const startedAt = toolStartedAt.get(block.tool_use_id);
        const ms = startedAt ? Math.round(performance.now() - startedAt) : undefined;
        const text = Array.isArray(block.content)
          ? block.content.map((c) => c.text).join(' ')
          : (block.content ?? '');
        emit({
          type: 'tool_result',
          id: block.tool_use_id,
          summary: summarize(text),
          is_error: block.is_error,
          ms,
        });
        emittedToolResultIds.add(block.tool_use_id);
        if (block.is_error) {
          emit({
            type: 'policy_event',
            detail: 'tool_result marked error, likely policy enforce or upstream guard',
          });
        }
      }
      continue;
    }

    if (event.type === 'content_block_delta') {
      const delta = event.delta;
      if (delta.type === 'text_delta') {
        emit({ type: 'text', content: delta.text });
      } else if (delta.type === 'thinking_delta') {
        emit({ type: 'thinking', content: delta.thinking });
      }
      continue;
    }
  }

  // Defensive sweep, if any mcp_tool_result blocks did NOT flow through the
  // streaming events (older SDK paths or beta quirks), pick them up from the
  // final message and emit any we haven't emitted yet. Idempotent via the
  // seen-id set.
  const final = await stream.finalMessage();
  for (const block of final.content) {
    if (block.type === 'mcp_tool_result' && !emittedToolResultIds.has(block.tool_use_id)) {
      const startedAt = toolStartedAt.get(block.tool_use_id);
      const ms = startedAt ? Math.round(performance.now() - startedAt) : undefined;
      const text = Array.isArray(block.content)
        ? block.content.map((c) => c.text).join(' ')
        : (block.content ?? '');
      emit({
        type: 'tool_result',
        id: block.tool_use_id,
        summary: summarize(text),
        is_error: block.is_error,
        ms,
      });
      if (block.is_error) {
        emit({
          type: 'policy_event',
          detail: 'tool_result marked error, likely policy enforce or upstream guard',
        });
      }
    }
  }
};

export const POST = async (request: Request): Promise<Response> => {
  let organization_id: string;
  try {
    ({ organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return json(401, { error: 'unauthorized' });
    throw e;
  }

  const bodyJson = (await request.json().catch(() => null)) as unknown;
  const parsed = RunBody.safeParse(bodyJson);
  if (!parsed.success) {
    return json(400, { error: 'invalid body', details: parsed.error.flatten() });
  }
  const { prompt, mode, scope, serverId } = parsed.data;

  if (scope === 'server' && !serverId) {
    return json(400, { error: 'serverId is required when scope=server' });
  }

  // Env check BEFORE reserving a slot, otherwise a missing platform key on
  // prod would silently consume rate-limit slots for every visitor.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: 'anthropic_api_key_missing' });

  // Wallet protection: cap Anthropic-billed runs per org per hour. Reserved
  // before the model call so an aborted run still consumes its slot. Failure
  // to reserve = fail closed; we never call Anthropic without accounting.
  const slot = await reservePlaygroundSlot(organization_id);
  if (!slot.allowed) {
    return new Response(
      JSON.stringify({
        error: 'rate_limit',
        limit: slot.limit,
        used: slot.used,
        resetAt: slot.resetAt,
        retryAfterSeconds: slot.retryAfterSeconds,
        windowHours: 1,
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(slot.retryAfterSeconds),
        },
      },
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const started = performance.now();
  // One trace_id covers tools/list + every tools/call this Anthropic stream
  // produces. Threaded into the gateway via `?trace_id=` query param; the
  // gateway-handler validates + uses it as the trace_id on every audit row.
  const traceId = randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let toolCalls = 0;
      let policyEvents = 0;
      let thinkingChars = 0;
      const emit = (event: StreamEvent): void => {
        if (event.type === 'tool_call') toolCalls += 1;
        if (event.type === 'policy_event') policyEvents += 1;
        if (event.type === 'thinking') thinkingChars += event.content.length;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // controller closed (client aborted), stop emitting
        }
      };

      try {
        const minted = await mintPlaygroundToken(organization_id);
        if (!minted) {
          emit({ type: 'error', message: 'failed to mint gateway token' });
          return;
        }
        const url = buildMcpUrl({ mode, scope, serverId, traceId });
        await runWithMcp(anthropic, prompt, url, minted.plaintext, emit);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'run failed';
        emit({ type: 'error', message });
      } finally {
        const ms = Math.round(performance.now() - started);
        emit({
          type: 'done',
          stats: {
            tool_calls: toolCalls,
            ms,
            policy_events: policyEvents,
            thinking_chars: thinkingChars,
            trace_id: traceId,
          },
        });
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
