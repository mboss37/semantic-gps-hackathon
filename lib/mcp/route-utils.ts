import type { ToolRow } from '@/lib/manifest/cache';
import type { ToolCatalogEntry } from '@/lib/mcp/tool-dispatcher';

export type ExecuteRouteCtx = {
  traceId: string;
  organizationId: string | null;
};

export type CapturedStep = {
  args: Record<string, unknown>;
  result: unknown;
};

const STEPS_PREFIX = '$steps.';
const INPUTS_PREFIX = '$inputs.';

const resolveStepRef = (
  path: string,
  captureBag: Record<string, CapturedStep>,
): unknown => {
  const segments = path.slice(STEPS_PREFIX.length).split('.');
  const captureKey = segments[0];
  if (captureKey === undefined || captureKey === '') {
    throw new Error(`empty segment in "${path}"`);
  }
  const rest = segments.slice(1);
  const captured = captureBag[captureKey];
  if (captured === undefined) {
    throw new Error(`"${path}" references unknown capture key "${captureKey}"`);
  }

  let cursor: unknown;
  let pathSegments: string[];
  if (rest[0] === 'args') {
    cursor = captured.args;
    pathSegments = rest.slice(1);
  } else if (rest[0] === 'result') {
    cursor = captured.result;
    pathSegments = rest.slice(1);
  } else {
    cursor = captured.result;
    pathSegments = rest;
  }

  for (const seg of pathSegments) {
    if (seg === '') {
      throw new Error(`empty segment in "${path}"`);
    }
    if (cursor === null || cursor === undefined) {
      throw new Error(`"${path}" traversal hit null/undefined at segment "${seg}"`);
    }
    if (Array.isArray(cursor) && /^\d+$/.test(seg)) {
      cursor = cursor[Number(seg)];
      continue;
    }
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[seg];
      continue;
    }
    throw new Error(`"${path}" traversal reached a primitive at segment "${seg}"`);
  }
  return cursor;
};

export const resolveInputMapping = (
  mapping: Record<string, unknown>,
  inputs: Record<string, unknown>,
  captureBag: Record<string, CapturedStep>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(mapping)) {
    if (typeof raw !== 'string') {
      out[key] = raw;
      continue;
    }
    if (raw.startsWith(STEPS_PREFIX)) {
      out[key] = resolveStepRef(raw, captureBag);
      continue;
    }
    if (raw.startsWith(INPUTS_PREFIX)) {
      out[key] = inputs[raw.slice(INPUTS_PREFIX.length)];
      continue;
    }
    out[key] = raw;
  }
  return out;
};

export const findCatalogEntry = (
  catalog: ToolCatalogEntry[],
  tool: ToolRow,
): ToolCatalogEntry | undefined =>
  catalog.find((c) => c.tool_id === tool.id && c.source === 'manifest');

// Sprint 19: in-process HTTP-Streamable MCPs (SF/Slack/GitHub) return MCP
// content arrays [{type:"text", text:"<JSON>"}] — proxy-http.ts::extractResult
// already strips the outer {content:...} wrapper, so what reaches the capture
// bag is a bare array of content parts (or, defensively, the wrapped form).
// Unwrap at capture time so input_mapping / rollback_input_mapping path
// traversal sees the logical object, not the envelope. OpenAPI proxies
// already return unwrapped bodies — those pass through untouched.
const tryParseTextPart = (part: unknown): unknown | undefined => {
  if (
    typeof part !== 'object' ||
    part === null ||
    (part as { type?: unknown }).type !== 'text' ||
    typeof (part as { text?: unknown }).text !== 'string'
  ) {
    return undefined;
  }
  const text = (part as { text: string }).text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const unwrapMcpEnvelope = (result: unknown): unknown => {
  if (Array.isArray(result) && result.length > 0) {
    const parsed = tryParseTextPart(result[0]);
    if (parsed !== undefined) return parsed;
    return result;
  }
  if (typeof result === 'object' && result !== null && 'content' in result) {
    const content = (result as { content: unknown }).content;
    if (Array.isArray(content) && content.length > 0) {
      const parsed = tryParseTextPart(content[0]);
      if (parsed !== undefined) return parsed;
    }
  }
  return result;
};
