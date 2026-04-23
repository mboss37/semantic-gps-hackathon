import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { modelEvaluateGoal } from '@/lib/config/models';
import type { Manifest, RouteRow, ToolRow } from '@/lib/manifest/cache';
import type {
  EvaluateGoalCandidate,
  EvaluateGoalParams,
  EvaluateGoalResult,
} from '@/lib/mcp/trel-schemas';

// Goal-to-route matcher. Two tiers:
//  1. Keyword scorer — always runs, always finishes. Primary response path.
//  2. Opus 4.7 ranker — engaged when ANTHROPIC_API_KEY is present. Silent
//     fallback to tier 1 on any failure (API error, parse miss, quota).

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

const scoreText = (goalTokens: string[], haystack: string): number => {
  const text = haystack.toLowerCase();
  return goalTokens.reduce((acc, tok) => (text.includes(tok) ? acc + 1 : acc), 0);
};

const routeSteps = (
  route: RouteRow,
  manifest: Manifest,
): Array<{ tool_name: string; tool_id: string }> => {
  const steps = manifest.route_steps
    .filter((s) => s.route_id === route.id)
    .slice()
    .sort((a, b) => a.step_order - b.step_order);
  const out: Array<{ tool_name: string; tool_id: string }> = [];
  for (const step of steps) {
    const tool = manifest.tools.find((t) => t.id === step.tool_id);
    if (!tool) continue;
    out.push({ tool_name: tool.name, tool_id: tool.id });
  }
  return out;
};

const scoreRoute = (route: RouteRow, goalTokens: string[], manifest: Manifest): number => {
  const tools = routeSteps(route, manifest);
  const toolText = tools
    .map((s) => {
      const tool = manifest.tools.find((t) => t.id === s.tool_id);
      return `${s.tool_name} ${tool?.description ?? ''}`;
    })
    .join(' ');
  const haystack = `${route.name} ${route.description ?? ''} ${toolText}`;
  return scoreText(goalTokens, haystack);
};

const rankKeyword = (params: EvaluateGoalParams, manifest: Manifest): EvaluateGoalResult => {
  const goalTokens = tokenize(params.goal);
  const maxCandidates = params.max_candidates ?? 3;

  const scored = manifest.routes
    .map((route) => ({
      route,
      score: scoreRoute(route, goalTokens, manifest),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const candidates: EvaluateGoalCandidate[] = scored.slice(0, maxCandidates).map((entry) => ({
     kind: 'route',
     id: entry.route.id,
     name: entry.route.name,
     steps: routeSteps(entry.route, manifest),
     relevance: topScore > 0 ? entry.score / topScore : 0,
     rationale: `keyword match: ${entry.score} token hit(s) across route name, description, and step tools`,
  }));

  return {
    candidates,
    rationale_overall:
      candidates.length > 0
        ? `Ranked ${candidates.length} route(s) by keyword overlap with goal "${params.goal}".`
        : `No manifest routes matched goal "${params.goal}".`,
  };
};

// Opus tier. Cached system prompt summarises the manifest; user turn is the
// goal + a strict JSON schema. We validate the reply and fall back if it
// doesn't match, so a hallucinating model can never break the method.

const MANIFEST_TOKEN_BUDGET = 4000;
const MAX_TOKENS = 400;

const compactManifest = (manifest: Manifest): string => {
  const routes = manifest.routes.map((r) => {
    const steps = routeSteps(r, manifest)
      .map((s) => s.tool_name)
      .join(' -> ');
    return `- ${r.name} (id=${r.id}): ${r.description ?? 'no description'} | steps: ${steps || 'none'}`;
  });
  const tools = manifest.tools.map((t: ToolRow) => `- ${t.name}: ${t.description ?? ''}`);
  const text = `Routes:\n${routes.join('\n')}\n\nTools:\n${tools.join('\n')}`;
  // Cheap token guard — keep the system prompt bounded regardless of manifest size.
  return text.length > MANIFEST_TOKEN_BUDGET
    ? `${text.slice(0, MANIFEST_TOKEN_BUDGET)}\n[truncated]`
    : text;
};

const OpusCandidateSchema = z.object({
  kind: z.enum(['route', 'tool_sequence']),
  id: z.string().optional(),
  name: z.string().optional(),
  steps: z.array(z.object({ tool_name: z.string(), tool_id: z.string() })).default([]),
  relevance: z.number().min(0).max(1),
  rationale: z.string(),
});

const OpusReplySchema = z.object({
  candidates: z.array(OpusCandidateSchema),
  rationale_overall: z.string().optional(),
});

const parseOpusReply = (text: string): EvaluateGoalResult | null => {
  // Model sometimes wraps JSON in ```json fences — strip to the first { / last }.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  const slice = text.slice(firstBrace, lastBrace + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return null;
  }
  const result = OpusReplySchema.safeParse(parsed);
  if (!result.success) return null;
  return {
    candidates: result.data.candidates.map((c) => ({
      kind: c.kind,
      id: c.id,
      name: c.name,
      steps: c.steps,
      relevance: c.relevance,
      rationale: c.rationale,
    })),
    rationale_overall: result.data.rationale_overall ?? 'Ranked by Opus 4.7 against manifest.',
  };
};

const rankOpus = async (
  params: EvaluateGoalParams,
  manifest: Manifest,
  apiKey: string,
): Promise<EvaluateGoalResult | null> => {
  const maxCandidates = params.max_candidates ?? 3;
  const manifestText = compactManifest(manifest);
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: modelEvaluateGoal(),
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: `You rank manifest routes against a user goal for an MCP control plane. Respond with ONLY JSON matching: { candidates: Array<{ kind: "route" | "tool_sequence", id?: string, name?: string, steps: Array<{ tool_name: string, tool_id: string }>, relevance: number (0..1), rationale: string }>, rationale_overall?: string }. Return at most ${maxCandidates} candidates. Only cite route ids that exist in the manifest below.\n\n${manifestText}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Goal: ${params.goal}\nReturn the JSON object now.`,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;
    return parseOpusReply(textBlock.text);
  } catch {
    return null;
  }
};

export const evaluateGoal = async (
  params: EvaluateGoalParams,
  manifest: Manifest,
): Promise<EvaluateGoalResult> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const opus = await rankOpus(params, manifest, apiKey);
    if (opus && opus.candidates.length > 0) return opus;
  }
  return rankKeyword(params, manifest);
};
