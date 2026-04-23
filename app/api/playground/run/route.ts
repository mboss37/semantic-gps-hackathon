import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { hashToken } from '@/lib/mcp/auth-token';
import { RAW_TOOL_DEFS, dispatchRawTool } from '@/lib/playground/raw-dispatch';
import { randomUUID } from 'node:crypto';

// Sprint 8 WP-J.1: Playground A/B run endpoint. Two modes:
//   - 'raw'     — curated 3-tool subset calling the SAME real SF/Slack/GH
//                 proxies as the gateway, but bypassing policies, relationship
//                 hints, rollback, and audit. Both panes burn real API quota
//                 and land real side effects — the contrast is governance,
//                 not authenticity.
//   - 'gateway' — real Opus 4.7 via the Anthropic beta mcp_servers connector
//                 pointed at our /api/mcp gateway with a bearer token we
//                 mint on-the-fly for this request (org-scoped, single-use
//                 purpose). Policies + relationships + audit all fire.
//
// Output is newline-delimited JSON events to keep the client renderer simple.
// Each pane runs independently via two fetches from the browser.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Extended duration — Opus + MCP roundtrips can run 20-60s.
export const maxDuration = 120;

const RunBody = z.object({
  prompt: z.string().min(1).max(4000),
  mode: z.enum(['raw', 'gateway']),
});

type StreamEvent =
  | {
      type: 'tool_call';
      id: string;
      name: string;
      args_preview: string;
    }
  | {
      type: 'tool_result';
      id: string;
      summary: string;
      is_error?: boolean;
    }
  | { type: 'text'; content: string }
  | { type: 'policy_event'; detail: string }
  | { type: 'error'; message: string }
  | {
      type: 'done';
      stats: { tool_calls: number; ms: number; policy_events?: number };
    };

const argsPreview = (input: unknown): string => {
  try {
    const json = JSON.stringify(input);
    return json.length > 120 ? `${json.slice(0, 117)}…` : json;
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

// -- RAW mode — real upstreams, no control plane -----------------------------
//
// Minimum viable 3-tool subset. Tool descriptions are deliberately bare so
// Opus gets no relationship hints (`find_account produces_input_for
// find_contact`), no PII policy scrubs the email, no rollback if
// `create_issue` succeeds and `chat_post_message` then fails. All dispatch
// logic + bare tool defs live in `lib/playground/raw-dispatch.ts`.

// Opus agent loop for RAW mode. Real upstreams — same SF/Slack/GitHub proxies
// as the gateway uses, but WITHOUT the policy stack, relationship hints,
// rollback, or audit wrapped around them. Both panes burn the same API
// quota and land the same real side effects; the contrast is in governance,
// not in authenticity. Max 6 turns so a bad prompt can't run away.
const runRaw = async (
  anthropic: Anthropic,
  prompt: string,
  organizationId: string,
  emit: (event: StreamEvent) => void,
): Promise<void> => {
  const traceId = randomUUID();
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: prompt },
  ];
  const maxTurns = 6;
  let turn = 0;

  while (turn < maxTurns) {
    turn += 1;
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      tools: RAW_TOOL_DEFS,
      messages,
    });

    const toolUses: Anthropic.Messages.ToolUseBlock[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        emit({ type: 'text', content: block.text });
      } else if (block.type === 'tool_use') {
        toolUses.push(block);
      }
    }

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const input = (use.input as Record<string, unknown> | null) ?? {};
      emit({
        type: 'tool_call',
        id: use.id,
        name: use.name,
        args_preview: argsPreview(input),
      });
      const { content, is_error } = await dispatchRawTool(
        organizationId,
        use.name,
        input,
        traceId,
      );
      emit({
        type: 'tool_result',
        id: use.id,
        summary: summarize(content),
        is_error,
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content,
        is_error,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }
};

// -- GATEWAY mode -----------------------------------------------------------
//
// Uses Anthropic's beta mcp_servers connector. Opus calls tools/list +
// tools/call against our deployed gateway; policies + relationships +
// audit all fire upstream. We mint a short-lived bearer token scoped to
// the caller's org so the gateway never sees the user's session cookies.

const gatewayBaseUrl = (): string => {
  const explicit = process.env.SEMANTIC_GPS_GATEWAY_URL;
  if (explicit) return explicit;
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app && !app.includes('localhost')) return `${app.replace(/\/$/, '')}/api/mcp`;
  return 'https://semantic-gps-hackathon.vercel.app/api/mcp';
};

// Service client for the token mint. Reused pattern from the gateway itself.
const mintPlaygroundToken = async (
  organization_id: string,
): Promise<{ plaintext: string; id: string } | null> => {
  const { createServiceClient } = await import('@/lib/supabase/service');
  const supabase = createServiceClient();
  const plaintext = `sgps_${randomBytes(32).toString('hex')}`;
  const token_hash = hashToken(plaintext);
  const { data, error } = await supabase
    .from('gateway_tokens')
    .insert({
      organization_id,
      token_hash,
      name: `playground-${new Date().toISOString().slice(11, 19)}`,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return { plaintext, id: data.id };
};

const runGateway = async (
  anthropic: Anthropic,
  prompt: string,
  gatewayUrl: string,
  bearerToken: string,
  emit: (event: StreamEvent) => void,
): Promise<void> => {
  const response = await anthropic.beta.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    betas: ['mcp-client-2025-11-20'],
    mcp_servers: [
      {
        name: 'semantic-gps',
        type: 'url',
        url: gatewayUrl,
        authorization_token: bearerToken,
      },
    ],
    messages: [{ role: 'user', content: prompt }],
  });

  for (const block of response.content) {
    if (block.type === 'text') {
      emit({ type: 'text', content: block.text });
      continue;
    }
    if (block.type === 'mcp_tool_use') {
      const input = (block.input as Record<string, unknown> | null) ?? {};
      emit({
        type: 'tool_call',
        id: block.id,
        name: block.name,
        args_preview: argsPreview(input),
      });
      continue;
    }
    if (block.type === 'mcp_tool_result') {
      const text = Array.isArray(block.content)
        ? block.content.map((c) => c.text).join(' ')
        : block.content;
      emit({
        type: 'tool_result',
        id: block.tool_use_id,
        summary: summarize(text ?? ''),
        is_error: block.is_error,
      });
      if (block.is_error) {
        emit({
          type: 'policy_event',
          detail: `tool_result marked error — likely policy enforce or upstream guard`,
        });
      }
      continue;
    }
  }
};

// -- handler -----------------------------------------------------------------

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
  const { prompt, mode } = parsed.data;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: 'anthropic_api_key_missing' });

  const anthropic = new Anthropic({ apiKey });

  // NDJSON streaming response. Each line is a JSON object the client consumes.
  const encoder = new TextEncoder();
  const started = performance.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let toolCalls = 0;
      let policyEvents = 0;
      const emit = (event: StreamEvent): void => {
        if (event.type === 'tool_call') toolCalls += 1;
        if (event.type === 'policy_event') policyEvents += 1;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        if (mode === 'raw') {
          await runRaw(anthropic, prompt, organization_id, emit);
        } else {
          const minted = await mintPlaygroundToken(organization_id);
          if (!minted) {
            emit({ type: 'error', message: 'failed to mint gateway token' });
          } else {
            await runGateway(
              anthropic,
              prompt,
              gatewayBaseUrl(),
              minted.plaintext,
              emit,
            );
          }
        }
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
            ...(mode === 'gateway' ? { policy_events: policyEvents } : {}),
          },
        });
        controller.close();
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
