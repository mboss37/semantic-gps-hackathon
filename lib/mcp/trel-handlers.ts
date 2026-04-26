import type { Manifest, RelationshipRow, ToolRow } from '@/lib/manifest/cache';

// TRel (Typed Relationships) handlers. Pure functions that read the compiled
// manifest, no DB calls here so they stay testable with hand-rolled fixtures.

export type TrelNode = {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
};

export type TrelEdge = {
  id: string;
  from: string;
  to: string;
  type: RelationshipRow['relationship_type'];
  description: string;
};

export type DiscoverRelationshipsResult = {
  nodes: TrelNode[];
  edges: TrelEdge[];
};

export type WorkflowPathStep = {
  id: string;
  name: string;
  depth: number;
  reason: 'start' | 'reachable' | 'goal_match';
};

export type FindWorkflowPathResult = {
  path: WorkflowPathStep[];
  rationale: string;
};

// Edge types that flow "forward" in a workflow, the ones BFS should follow.
// `produces_input_for` is the data-flow spine; `suggests_after` is the soft
// recommendation; `alternative_to` lets BFS hop to equivalent substitutes.
const FORWARD_EDGE_TYPES = new Set<RelationshipRow['relationship_type']>([
  'produces_input_for',
  'suggests_after',
  'alternative_to',
]);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

const scoreToolAgainstGoal = (tool: ToolRow, goalTokens: string[]): number => {
  const haystack = `${tool.name} ${tool.description ?? ''}`.toLowerCase();
  return goalTokens.reduce((acc, tok) => (haystack.includes(tok) ? acc + 1 : acc), 0);
};

const pickStartingTool = (
  tools: ToolRow[],
  goal: string,
  startingTool: string | undefined,
): ToolRow | null => {
  if (startingTool) {
    return tools.find((t) => t.id === startingTool || t.name === startingTool) ?? null;
  }
  const tokens = tokenize(goal);
  if (tokens.length === 0) return null;
  let best: { tool: ToolRow; score: number } | null = null;
  for (const tool of tools) {
    const score = scoreToolAgainstGoal(tool, tokens);
    if (score > 0 && (!best || score > best.score)) {
      best = { tool, score };
    }
  }
  return best?.tool ?? null;
};

export const discoverRelationships = async (
  params: { server_id?: string } | undefined,
  manifest: Manifest,
): Promise<DiscoverRelationshipsResult> => {
  const m = manifest;
  const serverId = params?.server_id;
  const tools = serverId ? m.tools.filter((t) => t.server_id === serverId) : m.tools;
  const toolIds = new Set(tools.map((t) => t.id));
  const edges = m.relationships.filter(
    (r) => toolIds.has(r.from_tool_id) && toolIds.has(r.to_tool_id),
  );
  return {
    nodes: tools.map((t) => ({
      id: t.id,
      server_id: t.server_id,
      name: t.name,
      description: t.description,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.from_tool_id,
      to: e.to_tool_id,
      type: e.relationship_type,
      description: e.description,
    })),
  };
};

export const findWorkflowPath = async (
  params: { goal: string; starting_tool?: string; max_depth?: number },
  manifest: Manifest,
): Promise<FindWorkflowPathResult> => {
  const m = manifest;
  const maxDepth = params.max_depth ?? 3;
  const start = pickStartingTool(m.tools, params.goal, params.starting_tool);

  if (!start) {
    return {
      path: [],
      rationale: `No tool matched the goal "${params.goal}"${
        params.starting_tool ? ` and starting_tool "${params.starting_tool}" was not found` : ''
      }.`,
    };
  }

  const adj = new Map<string, Array<{ to: string; type: RelationshipRow['relationship_type'] }>>();
  for (const r of m.relationships) {
    if (!FORWARD_EDGE_TYPES.has(r.relationship_type)) continue;
    const bucket = adj.get(r.from_tool_id) ?? [];
    bucket.push({ to: r.to_tool_id, type: r.relationship_type });
    adj.set(r.from_tool_id, bucket);
  }

  const goalTokens = tokenize(params.goal);
  const visited = new Map<string, number>([[start.id, 0]]);
  const queue: Array<{ id: string; depth: number }> = [{ id: start.id, depth: 0 }];

  while (queue.length > 0) {
    const head = queue.shift();
    if (!head) break;
    if (head.depth >= maxDepth) continue;
    for (const { to } of adj.get(head.id) ?? []) {
      if (visited.has(to)) continue;
      visited.set(to, head.depth + 1);
      queue.push({ id: to, depth: head.depth + 1 });
    }
  }

  const path: WorkflowPathStep[] = [];
  for (const [id, depth] of visited) {
    const tool = m.tools.find((t) => t.id === id);
    if (!tool) continue;
    const isStart = id === start.id;
    const goalHit = !isStart && scoreToolAgainstGoal(tool, goalTokens) > 0;
    path.push({
      id,
      name: tool.name,
      depth,
      reason: isStart ? 'start' : goalHit ? 'goal_match' : 'reachable',
    });
  }

  path.sort((a, b) => a.depth - b.depth);

  return {
    path,
    rationale: `BFS from "${start.name}" (depth≤${maxDepth}) following ${[...FORWARD_EDGE_TYPES].join(', ')} edges. ${
      path.filter((s) => s.reason === 'goal_match').length
    } downstream tool(s) matched goal keywords.`,
  };
};
