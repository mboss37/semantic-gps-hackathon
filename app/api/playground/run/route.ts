import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { modelPlayground } from '@/lib/config/models';
import { hashToken } from '@/lib/mcp/auth-token';

// Sprint 8 WP-J.1 (refactored): Playground A/B run endpoint. Both modes use
// Anthropic's beta mcp_servers connector — same Opus, same prompt, same max
// tokens, same bearer. The ONLY difference is the MCP URL:
//   - 'raw'     → /api/mcp/raw (no policies, no relationships, no TRel, no
//                 semantic rewriting, origin tool names only)
//   - 'gateway' → /api/mcp     (full control plane)
// The contrast is governance, not model, prompt, or connection shape — that's
// the whole point of the hero demo.
//
// Output is newline-delimited JSON events to keep the client renderer simple.
// Each pane runs independently via two fetches from the browser.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Model ID is read via `modelPlayground()` at call time (not module load) so
// the env guard fires per-request. Set `PLAYGROUND_MODEL=claude-opus-4-7` in
// prod/demo and e.g. `PLAYGROUND_MODEL=claude-sonnet-4-6` in local .env.local
// for cheaper iteration. Both panes use the SAME model so the contrast stays
// "governance vs no governance," not "model A vs model B". No hardcoded
// fallback — we fail loud instead of silently shipping the wrong model.

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

// -- Shared MCP agent loop ---------------------------------------------------
//
// Single code path for both panes. Anthropic's beta `mcp_servers` connector
// does the tools/list + tools/call round-trips on the server side; we just
// need to render the `mcp_tool_use` / `mcp_tool_result` blocks back as NDJSON
// events. `mcp-client-2025-11-20` requires a paired `mcp_toolset` entry
// whose `mcp_server_name` matches `mcp_servers[].name` exactly (memory
// 93a1fa1e).

const gatewayBaseUrl = (): string => {
  const explicit = process.env.SEMANTIC_GPS_GATEWAY_URL;
  if (explicit) return explicit;
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app && !app.includes('localhost')) return `${app.replace(/\/$/, '')}/api/mcp`;
  return 'https://semantic-gps-hackathon.vercel.app/api/mcp';
};

const rawBaseUrl = (): string => gatewayBaseUrl().replace(/\/api\/mcp$/, '/api/mcp/raw');

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

const runWithMcp = async (
  anthropic: Anthropic,
  prompt: string,
  url: string,
  bearerToken: string,
  emit: (event: StreamEvent) => void,
): Promise<void> => {
  const response = await anthropic.beta.messages.create({
    model: modelPlayground(),
    max_tokens: 2048,
    betas: ['mcp-client-2025-11-20'],
    mcp_servers: [
      {
        name: 'semantic-gps',
        type: 'url',
        url,
        authorization_token: bearerToken,
      },
    ],
    tools: [
      {
        type: 'mcp_toolset',
        mcp_server_name: 'semantic-gps',
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
        // Both modes mint a gateway token — the raw endpoint still lives on
        // our infra and still requires bearer auth. Customer agents would
        // authenticate against raw MCPs too; "ungoverned" means no policy
        // stack, not "open to the world". URL is the only variable.
        const minted = await mintPlaygroundToken(organization_id);
        if (!minted) {
          emit({ type: 'error', message: 'failed to mint gateway token' });
        } else {
          const url = mode === 'raw' ? rawBaseUrl() : gatewayBaseUrl();
          await runWithMcp(anthropic, prompt, url, minted.plaintext, emit);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'run failed';
        emit({ type: 'error', message });
      } finally {
        const ms = Math.round(performance.now() - started);
        // Both modes report policy_events — raw always reports 0 by
        // definition, which is the observable contrast on the client side.
        emit({
          type: 'done',
          stats: {
            tool_calls: toolCalls,
            ms,
            policy_events: policyEvents,
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
