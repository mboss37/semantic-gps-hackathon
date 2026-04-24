'use server';

import { requireAuth } from '@/lib/auth';
import { loadManifest } from '@/lib/manifest/cache';
import { discoverRelationships } from '@/lib/mcp/trel-handlers';

// Session-authed server action that replaces the former browser-side
// `fetch('/api/mcp', { method: 'POST', body: discover_relationships })`.
// That call generated `method='auth' status='unauthorized'` rows on every
// Workflow Graph page load because the browser couldn't include a gateway
// bearer token. This action reads the manifest + runs the TRel handler
// directly — same data, zero HTTP roundtrip, zero audit noise. Matches the
// pattern used by every other dashboard page (lib/servers/fetch.ts,
// lib/monitoring/fetch.ts, lib/routes/fetch.ts).

type TrelNode = {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
};

type TrelEdgeType =
  | 'produces_input_for'
  | 'requires_before'
  | 'suggests_after'
  | 'mutually_exclusive'
  | 'alternative_to'
  | 'validates'
  | 'compensated_by'
  | 'fallback_to';

type TrelEdge = {
  id: string;
  from: string;
  to: string;
  type: TrelEdgeType;
  description: string;
};

export type GraphData = { nodes: TrelNode[]; edges: TrelEdge[] };

export const fetchGraphData = async (): Promise<GraphData> => {
  const ctx = await requireAuth();
  const manifest = await loadManifest({
    kind: 'org',
    organization_id: ctx.organization_id,
  });
  const result = await discoverRelationships(undefined, manifest);
  return {
    nodes: result.nodes,
    edges: result.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      type: e.type as TrelEdgeType,
      description: e.description,
    })),
  };
};
