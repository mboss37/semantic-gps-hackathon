import { z } from 'zod';

// Typed Relationships + orchestration. Non-standard JSON-RPC methods exposed
// on /api/mcp alongside the MCP builtins. They share the auth + policy +
// audit stack with tools/call because they flow through the same McpServer.

export const DiscoverRelationshipsRequestSchema = z.object({
  method: z.literal('discover_relationships'),
  params: z
    .object({
      server_id: z.string().uuid().optional(),
    })
    .optional(),
});

export const FindWorkflowPathRequestSchema = z.object({
  method: z.literal('find_workflow_path'),
  params: z.object({
    goal: z.string().min(1).describe('Plain-language workflow goal to satisfy.'),
    starting_tool: z
      .string()
      .optional()
      .describe('Tool UUID or exact tool name. Optional — if omitted we pick one by goal keyword match.'),
    max_depth: z.number().int().min(1).max(6).optional(),
  }),
});

export const ExecuteRouteRequestSchema = z.object({
  method: z.literal('execute_route'),
  params: z.object({
    route_id: z.string().uuid().describe('Route UUID from the routes table.'),
    inputs: z
      .record(z.string(), z.unknown())
      .default({})
      .describe('Literal inputs bound into the first step; later steps can reference capture-bag values.'),
  }),
});

export type DiscoverRelationshipsParams = z.infer<
  typeof DiscoverRelationshipsRequestSchema
>['params'];
export type FindWorkflowPathParams = z.infer<
  typeof FindWorkflowPathRequestSchema
>['params'];
export type ExecuteRouteParams = z.infer<typeof ExecuteRouteRequestSchema>['params'];

export type ExecuteRouteStepStatus =
  | 'ok'
  | 'origin_error'
  | 'blocked_by_policy'
  | 'unauthorized';

export type ExecuteRouteFallbackUsed = {
  original_tool_name: string;
  fallback_tool_name: string;
  original_error: string;
};

export type ExecuteRouteRollback = {
  attempted: boolean;
  status: 'ok' | 'no_compensation_available' | 'compensation_failed';
  compensation_tool_name?: string;
  error?: string;
};

export type ExecuteRouteStep = {
  step_order: number;
  tool_name: string;
  status: ExecuteRouteStepStatus;
  latency_ms: number;
  result?: unknown;
  error?: string;
  fallback_used?: ExecuteRouteFallbackUsed;
  fallback_also_failed?: boolean;
  rollback?: ExecuteRouteRollback;
};

export type ExecuteRouteRollbackSummary = {
  attempted: boolean;
  compensated_count: number;
  skipped_count: number;
  failed_count: number;
};

export type ExecuteRouteResult = {
  ok: boolean;
  route_id: string;
  steps: ExecuteRouteStep[];
  halted_at_step?: number;
  rationale: string;
  rollback_summary?: ExecuteRouteRollbackSummary;
};

export const TREL_METHODS = [
  'discover_relationships',
  'find_workflow_path',
  'execute_route',
] as const;
export type TrelMethod = (typeof TREL_METHODS)[number];
