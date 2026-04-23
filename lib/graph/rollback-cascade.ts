// Pure mapping from `rollback_executed` events → highlighted graph edges.
// Extracted for unit testing; no React, no DOM. The viz component applies
// these edge ids to React Flow state with a staggered timer.

export type RollbackEventLike = {
  id: string;
  trace_id: string;
  payload: {
    original_tool?: string;
    compensation_tool?: string;
    original_step_order?: number;
  } | null;
};

export type GraphEdgeLike = {
  id: string;
  from: string; // tool id
  to: string; // tool id
  type: string;
};

export type GraphNodeLike = {
  id: string; // tool id
  name: string; // e.g. "sf.delete_contact"
};

export type CascadeHit = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  traceId: string;
  stepOrder: number | null;
  eventId: string;
};

export const mapRollbackEventsToEdges = (
  events: readonly RollbackEventLike[],
  nodes: readonly GraphNodeLike[],
  edges: readonly GraphEdgeLike[],
): CascadeHit[] => {
  if (events.length === 0 || nodes.length === 0 || edges.length === 0) {
    return [];
  }

  const nodeByName = new Map<string, GraphNodeLike>();
  for (const n of nodes) {
    nodeByName.set(n.name, n);
  }

  const edgeByPair = new Map<string, GraphEdgeLike>();
  for (const e of edges) {
    if (e.type !== 'compensated_by') continue;
    edgeByPair.set(`${e.from}|${e.to}`, e);
  }

  const hits: CascadeHit[] = [];
  for (const evt of events) {
    const original = evt.payload?.original_tool;
    const compensation = evt.payload?.compensation_tool;
    if (!original || !compensation) continue;

    const fromNode = nodeByName.get(original);
    const toNode = nodeByName.get(compensation);
    if (!fromNode || !toNode) continue;

    const edge = edgeByPair.get(`${fromNode.id}|${toNode.id}`);
    if (!edge) continue;

    hits.push({
      edgeId: edge.id,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      traceId: evt.trace_id,
      stepOrder: evt.payload?.original_step_order ?? null,
      eventId: evt.id,
    });
  }

  // F.3 emits events in reverse-step order as they fire; preserve that order
  // so the cascade animation walks the reverse path in arrival sequence.
  return hits;
};
