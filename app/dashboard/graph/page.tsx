'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCwIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  EDGE_STYLES,
  GraphLegend,
  ROLLBACK_HIGHLIGHT_STYLE,
} from '@/components/dashboard/graph-legend';
import { NodeDetailPanel, type NodeDetail } from '@/components/dashboard/node-detail-panel';
import { ToolNode } from '@/components/dashboard/tool-node';
import {
  mapRollbackEventsToEdges,
  type CascadeHit,
  type RollbackEventLike,
} from '@/lib/graph/rollback-cascade';
import { rollbackEventSchema, type RollbackEvent } from '@/lib/schemas/rollback-event';
import { fetchGraphData } from './actions';

type TrelNode = {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
};

type TrelEdge = {
  id: string;
  from: string;
  to: string;
  type: keyof typeof EDGE_STYLES;
  description: string;
};

type TrelResponse = { nodes: TrelNode[]; edges: TrelEdge[] };

const NODE_TYPES = { tool: ToolNode };

const POLL_MS = 2000;
const HIGHLIGHT_MS = 2200;
const CASCADE_STAGGER_MS = 400;
const SIMULATORS_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_DEMO_SIMULATORS === '1';

const layoutNodes = (nodes: TrelNode[]): Node[] => {
  // Simple grid layout keyed by server, good enough for a hackathon demo.
  const bySrv = new Map<string, TrelNode[]>();
  for (const n of nodes) {
    const bucket = bySrv.get(n.server_id) ?? [];
    bucket.push(n);
    bySrv.set(n.server_id, bucket);
  }
  const out: Node[] = [];
  let col = 0;
  for (const group of bySrv.values()) {
    group.forEach((n, i) => {
      out.push({
        id: n.id,
        type: 'tool',
        position: { x: col * 260, y: i * 90 },
        data: { name: n.name, description: n.description },
      });
    });
    col += 1;
  }
  return out;
};

const toRfEdges = (edges: TrelEdge[], litEdgeIds: ReadonlySet<string>): Edge[] =>
  edges.map((e) => {
    const isLit = litEdgeIds.has(e.id);
    const style = EDGE_STYLES[e.type] ?? EDGE_STYLES.produces_input_for;
    if (isLit) {
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        label: 'rolling back',
        style: {
          stroke: ROLLBACK_HIGHLIGHT_STYLE.stroke,
          strokeWidth: 3,
          strokeDasharray: '6 4',
        },
        labelStyle: { fill: ROLLBACK_HIGHLIGHT_STYLE.stroke, fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: '#1c0a0f' },
        animated: true,
        zIndex: 10,
      };
    }
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.type,
      style: { stroke: style.stroke, strokeWidth: 1.5 },
      labelStyle: { fill: style.stroke, fontSize: 10 },
      labelBgStyle: { fill: '#18181b' },
      animated: e.type === 'produces_input_for' || e.type === 'suggests_after',
    };
  });

const nodeStyleFor = (isLit: boolean): { border: string; boxShadow?: string } | undefined => {
  if (!isLit) return undefined;
  return {
    border: `2px solid ${ROLLBACK_HIGHLIGHT_STYLE.stroke}`,
    boxShadow: `0 0 12px ${ROLLBACK_HIGHLIGHT_STYLE.stroke}80`,
  };
};

const parseRollbackEvents = (raw: unknown): RollbackEvent[] => {
  if (!raw || typeof raw !== 'object') return [];
  const list = (raw as { events?: unknown }).events;
  if (!Array.isArray(list)) return [];
  const parsed = list
    .map((e) => rollbackEventSchema.safeParse(e))
    .filter((r): r is { success: true; data: RollbackEvent } => r.success)
    .map((r) => r.data);
  return parsed;
};

const GraphPage = () => {
  const [data, setData] = useState<TrelResponse>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [litEdgeIds, setLitEdgeIds] = useState<ReadonlySet<string>>(new Set());
  const [litNodeIds, setLitNodeIds] = useState<ReadonlySet<string>>(new Set());

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const lastSinceRef = useRef<string>(new Date().toISOString());
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Session-authed server action. Replaces the unauth'd
      // `fetch('/api/mcp')` that polluted audit with `status: unauthorized`
      // rows on every graph page load (Sprint 15 smoke-test finding).
      const result = await fetchGraphData();
      setData(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Graph load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const runCascade = useCallback((hits: readonly CascadeHit[]) => {
    if (hits.length === 0) return;
    clearTimers();

    hits.forEach((hit, i) => {
      const onStart = setTimeout(() => {
        setLitEdgeIds((prev) => {
          const next = new Set(prev);
          next.add(hit.edgeId);
          return next;
        });
        setLitNodeIds((prev) => {
          const next = new Set(prev);
          next.add(hit.fromNodeId);
          next.add(hit.toNodeId);
          return next;
        });
      }, i * CASCADE_STAGGER_MS);
      timersRef.current.push(onStart);

      const onEnd = setTimeout(() => {
        setLitEdgeIds((prev) => {
          const next = new Set(prev);
          next.delete(hit.edgeId);
          return next;
        });
        setLitNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(hit.fromNodeId);
          next.delete(hit.toNodeId);
          return next;
        });
      }, i * CASCADE_STAGGER_MS + HIGHLIGHT_MS);
      timersRef.current.push(onEnd);
    });
  }, [clearTimers]);

  // Poll rollback events; on new ones, map to edges and fire the cascade.
  useEffect(() => {
    if (data.edges.length === 0) return;
    let active = true;

    const pollRollbacks = async () => {
      try {
        const qs = new URLSearchParams({
          status: 'rollback_executed',
          since: lastSinceRef.current,
          limit: '25',
        });
        const res = await fetch(`/api/mcp-events?${qs.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as unknown;
        const events = parseRollbackEvents(json);
        if (!active || events.length === 0) return;

        const fresh: RollbackEventLike[] = [];
        for (const e of events) {
          if (seenEventIdsRef.current.has(e.id)) continue;
          seenEventIdsRef.current.add(e.id);
          fresh.push({
            id: e.id,
            trace_id: e.trace_id,
            payload: e.payload as RollbackEventLike['payload'],
          });
          if (e.created_at > lastSinceRef.current) {
            lastSinceRef.current = e.created_at;
          }
        }
        if (fresh.length === 0) return;

        // Events arrive newest-first from the API; reverse so the animation
        // walks the actual halt→rollback sequence (step N down to step 1).
        fresh.reverse();

        const hits = mapRollbackEventsToEdges(fresh, data.nodes, data.edges);
        if (hits.length > 0) runCascade(hits);
      } catch {
        // Polling is best-effort; quiet failures avoid toast spam.
      }
    };

    // Fire once immediately so a rollback that happened while the page was
    // mounting still lights up, then tick.
    void pollRollbacks();
    const timer = setInterval(() => void pollRollbacks(), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [data.edges, data.nodes, runCascade]);

  useEffect(() => clearTimers, [clearTimers]);

  const nodes = useMemo(() => {
    const base = layoutNodes(data.nodes);
    if (litNodeIds.size === 0) return base;
    return base.map((n) => {
      const style = nodeStyleFor(litNodeIds.has(n.id));
      if (!style) return n;
      return { ...n, style: { ...n.style, ...style } };
    });
  }, [data.nodes, litNodeIds]);
  const edges = useMemo(() => toRfEdges(data.edges, litEdgeIds), [data.edges, litEdgeIds]);

  const onNodeClick: NodeMouseHandler = (_evt, node) => {
    const match = data.nodes.find((n) => n.id === node.id);
    if (match) setDetail(match);
  };

  const simulateCascade = useCallback(() => {
    const compEdges = data.edges.filter((e) => e.type === 'compensated_by');
    if (compEdges.length === 0) {
      toast.info('No compensated_by edges in the graph yet.');
      return;
    }
    const nodeById = new Map(data.nodes.map((n) => [n.id, n] as const));
    const synthetic: RollbackEventLike[] = [];
    const traceId = `sim-${Date.now()}`;
    compEdges.forEach((edge, i) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return;
      synthetic.push({
        id: `sim-evt-${Date.now()}-${i}`,
        trace_id: traceId,
        payload: {
          original_tool: from.name,
          compensation_tool: to.name,
          original_step_order: compEdges.length - i,
        },
      });
    });
    const hits = mapRollbackEventsToEdges(synthetic, data.nodes, data.edges);
    if (hits.length === 0) {
      toast.warning('Simulator found no mappable edges.');
      return;
    }
    runCascade(hits);
    toast.success(`Simulating rollback cascade (${hits.length} edge${hits.length === 1 ? '' : 's'})`);
  }, [data.edges, data.nodes, runCascade]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Workflow Graph</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.nodes.length} tool{data.nodes.length === 1 ? '' : 's'} · {data.edges.length}{' '}
            relationship{data.edges.length === 1 ? '' : 's'}. Click a node to inspect.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SIMULATORS_ENABLED && (
            <Button
              variant="outline"
              onClick={simulateCascade}
              disabled={loading || data.edges.length === 0}
              title="Dev-only: fire a synthetic rollback cascade on every compensated_by edge"
            >
              <RotateCcwIcon className="size-4" />
              Simulate rollback cascade
            </Button>
          )}
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </Button>
        </div>
      </header>

      <GraphLegend />

      <div className="relative h-[560px] rounded-lg border bg-background">
        {data.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : 'No tools yet. Import the demo OpenAPI on the Servers page to populate the graph.'}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            onNodeClick={onNodeClick}
            colorMode="dark"
          >
            <Background color="#27272a" gap={24} />
            <Controls />
            <MiniMap pannable zoomable className="!bg-zinc-900" />
          </ReactFlow>
        )}
        <NodeDetailPanel detail={detail} onClose={() => setDetail(null)} />
        {litEdgeIds.size > 0 && (
          <div
            className="pointer-events-none absolute left-3 top-3 rounded-md border border-rose-900/60 bg-rose-950/60 px-2.5 py-1.5 text-[11px] font-medium text-rose-200 shadow"
            role="status"
            aria-live="polite"
          >
            Rollback cascade in flight · {litEdgeIds.size} edge{litEdgeIds.size === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphPage;
