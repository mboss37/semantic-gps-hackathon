import { describe, expect, it } from 'vitest';
import {
  mapRollbackEventsToEdges,
  type GraphEdgeLike,
  type GraphNodeLike,
  type RollbackEventLike,
} from '@/lib/graph/rollback-cascade';

// Sprint 8 WP-I.2: pure mapping between rollback_executed events and the
// compensated_by edges they should light up in the graph viz. No React, no
// DOM, just the lookup + filtering logic. The animation layer sits on top
// in app/dashboard/graph/page.tsx.

const nodes: GraphNodeLike[] = [
  { id: 'node-create-account', name: 'sf.create_account' },
  { id: 'node-delete-account', name: 'sf.delete_account' },
  { id: 'node-create-contact', name: 'sf.create_contact' },
  { id: 'node-delete-contact', name: 'sf.delete_contact' },
  { id: 'node-create-task', name: 'sf.create_task' },
  { id: 'node-delete-task', name: 'sf.delete_task' },
  { id: 'node-produces-1', name: 'sf.get_account' },
];

const edges: GraphEdgeLike[] = [
  {
    id: 'edge-comp-account',
    from: 'node-create-account',
    to: 'node-delete-account',
    type: 'compensated_by',
  },
  {
    id: 'edge-comp-contact',
    from: 'node-create-contact',
    to: 'node-delete-contact',
    type: 'compensated_by',
  },
  {
    id: 'edge-comp-task',
    from: 'node-create-task',
    to: 'node-delete-task',
    type: 'compensated_by',
  },
  {
    // Non-compensation edge, must never be highlighted.
    id: 'edge-produces-account',
    from: 'node-produces-1',
    to: 'node-create-account',
    type: 'produces_input_for',
  },
];

const mkEvent = (
  id: string,
  original: string | undefined,
  compensation: string | undefined,
  stepOrder: number | null = null,
  traceId = 'trace-a',
): RollbackEventLike => ({
  id,
  trace_id: traceId,
  payload:
    original === undefined && compensation === undefined && stepOrder === null
      ? null
      : {
          original_tool: original,
          compensation_tool: compensation,
          original_step_order: stepOrder ?? undefined,
        },
});

describe('mapRollbackEventsToEdges', () => {
  it('returns empty when there are no events', () => {
    expect(mapRollbackEventsToEdges([], nodes, edges)).toEqual([]);
  });

  it('returns empty when the graph has no nodes or edges', () => {
    const evt = mkEvent('e1', 'sf.create_account', 'sf.delete_account', 1);
    expect(mapRollbackEventsToEdges([evt], [], edges)).toEqual([]);
    expect(mapRollbackEventsToEdges([evt], nodes, [])).toEqual([]);
  });

  it('maps a single event to its compensated_by edge', () => {
    const evt = mkEvent('e1', 'sf.create_account', 'sf.delete_account', 1);
    const hits = mapRollbackEventsToEdges([evt], nodes, edges);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({
      edgeId: 'edge-comp-account',
      fromNodeId: 'node-create-account',
      toNodeId: 'node-delete-account',
      traceId: 'trace-a',
      stepOrder: 1,
      eventId: 'e1',
    });
  });

  it('maps multiple events in reverse step order (arrival sequence preserved)', () => {
    // F.3 walks completed steps in reverse, step 3 halts, compensations
    // fire for step 2 then step 1, landing events in that order.
    const events = [
      mkEvent('e2', 'sf.create_contact', 'sf.delete_contact', 2),
      mkEvent('e1', 'sf.create_account', 'sf.delete_account', 1),
    ];
    const hits = mapRollbackEventsToEdges(events, nodes, edges);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.edgeId)).toEqual(['edge-comp-contact', 'edge-comp-account']);
    expect(hits.map((h) => h.stepOrder)).toEqual([2, 1]);
  });

  it('silently ignores events with unknown tool names', () => {
    const events = [
      mkEvent('e1', 'sf.create_account', 'sf.delete_account', 1),
      mkEvent('e2', 'sf.unknown_ghost', 'sf.delete_ghost', 2),
      mkEvent('e3', undefined, 'sf.delete_contact', 3),
      mkEvent('e4', 'sf.create_contact', undefined, 4),
      mkEvent('e5', undefined, undefined, null, 'trace-b'),
    ];
    const hits = mapRollbackEventsToEdges(events, nodes, edges);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.eventId).toBe('e1');
  });

  it('ignores events that point at a non-compensated_by edge', () => {
    // sf.get_account → sf.create_account exists only as produces_input_for
    // in the fixture. A rollback event naming that pair must not light
    // anything up even though both nodes exist.
    const evt = mkEvent('e1', 'sf.get_account', 'sf.create_account', 1);
    const hits = mapRollbackEventsToEdges([evt], nodes, edges);
    expect(hits).toEqual([]);
  });

  it('ignores events with a null payload', () => {
    const evt = mkEvent('e1', undefined, undefined);
    const hits = mapRollbackEventsToEdges([evt], nodes, edges);
    expect(hits).toEqual([]);
  });

  it('handles a full 3-step cascade across a real-shaped manifest', () => {
    const events = [
      mkEvent('e-task', 'sf.create_task', 'sf.delete_task', 3, 'trace-x'),
      mkEvent('e-contact', 'sf.create_contact', 'sf.delete_contact', 2, 'trace-x'),
      mkEvent('e-account', 'sf.create_account', 'sf.delete_account', 1, 'trace-x'),
    ];
    const hits = mapRollbackEventsToEdges(events, nodes, edges);
    expect(hits).toHaveLength(3);
    expect(hits.every((h) => h.traceId === 'trace-x')).toBe(true);
    expect(hits.map((h) => h.edgeId)).toEqual([
      'edge-comp-task',
      'edge-comp-contact',
      'edge-comp-account',
    ]);
  });
});
