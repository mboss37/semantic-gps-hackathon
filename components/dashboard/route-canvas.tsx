'use client';

import { useMemo, useState } from 'react';
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
import { EDGE_STYLES } from '@/components/dashboard/graph-legend';
import { ToolNode } from '@/components/dashboard/tool-node';
import { RouteStepDetailPanel } from '@/components/dashboard/route-step-detail-panel';
import type { RouteStepDetail } from '@/lib/routes/fetch';

const NODE_TYPES = { tool: ToolNode };

const STEP_X_SPACING = 300;
const ROLLBACK_Y = -160;
const FALLBACK_Y = 180;

const stepNodeId = (stepId: string): string => `step:${stepId}`;
const rollbackNodeId = (stepId: string): string => `rollback:${stepId}`;
const fallbackNodeId = (stepId: string): string => `fallback:${stepId}`;

type Props = {
  steps: RouteStepDetail[];
};

export const RouteCanvas = ({ steps }: Props) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    steps[0]?.id ?? null,
  );

  const { nodes, edges } = useMemo(() => buildGraph(steps, selectedStepId), [steps, selectedStepId]);

  const onNodeClick: NodeMouseHandler = (_, node) => {
    if (node.id.startsWith('step:')) {
      setSelectedStepId(node.id.slice('step:'.length));
    }
  };

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      <div className="h-[540px] rounded-lg border border-zinc-800 bg-zinc-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#27272a" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.id.startsWith('rollback:') ? '#a3a3a3' : '#0070f3')}
            maskColor="rgba(9, 9, 11, 0.8)"
          />
        </ReactFlow>
      </div>
      <RouteStepDetailPanel step={selectedStep} />
    </div>
  );
};

const buildGraph = (
  steps: RouteStepDetail[],
  selectedStepId: string | null,
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  steps.forEach((step, idx) => {
    const x = idx * STEP_X_SPACING;
    const isSelected = step.id === selectedStepId;

    nodes.push({
      id: stepNodeId(step.id),
      type: 'tool',
      position: { x, y: 0 },
      data: {
        name: `${step.step_order}. ${step.tool_display_name ?? step.tool_name}`,
        description: step.output_capture_key ? `→ $steps.${step.output_capture_key}` : null,
      },
      selected: isSelected,
    });

    if (idx > 0) {
      const prev = steps[idx - 1];
      edges.push({
        id: `e-step-${prev.id}-${step.id}`,
        source: stepNodeId(prev.id),
        target: stepNodeId(step.id),
        style: { stroke: EDGE_STYLES.produces_input_for.stroke, strokeWidth: 2 },
        animated: false,
      });
    }

    if (step.rollback_tool_id) {
      nodes.push({
        id: rollbackNodeId(step.id),
        type: 'tool',
        position: { x, y: ROLLBACK_Y },
        data: {
          name: step.rollback_tool_name ?? '—',
          description: 'rollback',
        },
      });
      edges.push({
        id: `e-rb-${step.id}`,
        source: stepNodeId(step.id),
        target: rollbackNodeId(step.id),
        style: {
          stroke: EDGE_STYLES.compensated_by.stroke,
          strokeWidth: 1.5,
          strokeDasharray: '4 3',
        },
        animated: false,
      });
    }

    if (step.fallback_route_id) {
      nodes.push({
        id: fallbackNodeId(step.id),
        type: 'tool',
        position: { x, y: FALLBACK_Y },
        data: {
          name: step.fallback_route_name ?? '—',
          description: 'fallback route',
        },
      });
      edges.push({
        id: `e-fb-${step.id}`,
        source: stepNodeId(step.id),
        target: fallbackNodeId(step.id),
        style: {
          stroke: EDGE_STYLES.fallback_to.stroke,
          strokeWidth: 1.5,
          strokeDasharray: '4 3',
        },
        animated: false,
      });
    }
  });

  return { nodes, edges };
};
