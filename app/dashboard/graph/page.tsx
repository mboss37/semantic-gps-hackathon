'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EDGE_STYLES, GraphLegend } from '@/components/dashboard/graph-legend';
import { NodeDetailPanel, type NodeDetail } from '@/components/dashboard/node-detail-panel';
import { ToolNode } from '@/components/dashboard/tool-node';

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

const layoutNodes = (nodes: TrelNode[]): Node[] => {
  // Simple grid layout keyed by server — good enough for a hackathon demo.
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

const toRfEdges = (edges: TrelEdge[]): Edge[] =>
  edges.map((e) => {
    const style = EDGE_STYLES[e.type] ?? EDGE_STYLES.produces_input_for;
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.type,
      style: { stroke: style.stroke, strokeWidth: 1.5 },
      labelStyle: { fill: style.stroke, fontSize: 10 },
      labelBgStyle: { fill: '#18181b' },
      // Animate the "live data" edges — same subset BFS walks forward.
      animated: e.type === 'produces_input_for' || e.type === 'suggests_after',
    };
  });

const GraphPage = () => {
  const [data, setData] = useState<TrelResponse>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<NodeDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'discover_relationships',
          params: {},
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const sseMatch = text.match(/data:\s*(\{[\s\S]*\})/);
      const payload = JSON.parse(sseMatch ? sseMatch[1] : text) as {
        result?: TrelResponse;
        error?: { message: string };
      };
      if (payload.error) throw new Error(payload.error.message);
      setData(payload.result ?? { nodes: [], edges: [] });
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

  const nodes = useMemo(() => layoutNodes(data.nodes), [data.nodes]);
  const edges = useMemo(() => toRfEdges(data.edges), [data.edges]);

  const onNodeClick: NodeMouseHandler = (_evt, node) => {
    const match = data.nodes.find((n) => n.id === node.id);
    if (match) setDetail(match);
  };

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
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
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
      </div>
    </div>
  );
};

export default GraphPage;
