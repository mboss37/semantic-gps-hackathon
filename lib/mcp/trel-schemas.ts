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

// Planning-time workflow linter. Caller supplies an ordered step list (tool
// names or ids) and we check it against the manifest's relationship graph +
// static-config policies. Offline / deterministic — no LLM.
export const ValidateWorkflowRequestSchema = z.object({
  method: z.literal('validate_workflow'),
  params: z.object({
    steps: z
      .array(
        z.object({
          tool: z.string().min(1).describe('Tool name OR tool UUID — resolver accepts either.'),
        }),
      )
      .min(1),
  }),
});

// Goal-to-route matcher. Keyword scorer always; Opus 4.7 ranking when the
// Anthropic API key is present. Opus path fails silently back to keywords.
export const EvaluateGoalRequestSchema = z.object({
  method: z.literal('evaluate_goal'),
  params: z.object({
    goal: z.string().min(1).describe('Plain-language goal to rank against manifest routes.'),
    max_candidates: z.number().int().min(1).max(10).optional(),
  }),
});

export type DiscoverRelationshipsParams = z.infer<
  typeof DiscoverRelationshipsRequestSchema
>['params'];
export type FindWorkflowPathParams = z.infer<
  typeof FindWorkflowPathRequestSchema
>['params'];
export type ExecuteRouteParams = z.infer<typeof ExecuteRouteRequestSchema>['params'];
export type ValidateWorkflowParams = z.infer<
  typeof ValidateWorkflowRequestSchema
>['params'];
export type EvaluateGoalParams = z.infer<typeof EvaluateGoalRequestSchema>['params'];

export type ExecuteRouteStepStatus =
  | 'ok'
  | 'origin_error'
  | 'blocked_by_policy'
  | 'unauthorized';

export type ExecuteRouteFallbackUsed = {
  original_tool_name: string;
  fallback_tool_name: string;
  fallback_tool_id: string;
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

// Result shapes for validate_workflow + evaluate_goal. Exported for test
// assertions and future callers that want typed responses.
export type ValidateWorkflowIssueCode =
  | 'unknown_tool'
  | 'missing_prerequisite'
  | 'mutually_exclusive'
  | 'policy_blocks';

export type ValidateWorkflowIssue = {
  step_index: number;
  severity: 'error' | 'warning';
  code: ValidateWorkflowIssueCode;
  message: string;
  tool?: string;
  expected_preceding_tool?: string;
};

export type ValidateWorkflowResult = {
  valid: boolean;
  issues: ValidateWorkflowIssue[];
  graph_coverage: number;
};

export type EvaluateGoalCandidate = {
  kind: 'route' | 'tool_sequence';
  id?: string;
  name?: string;
  steps: Array<{ tool_name: string; tool_id: string }>;
  relevance: number;
  rationale: string;
};

export type EvaluateGoalResult = {
  candidates: EvaluateGoalCandidate[];
  rationale_overall: string;
};

export const TREL_METHODS = [
  'discover_relationships',
  'find_workflow_path',
  'execute_route',
  'validate_workflow',
  'evaluate_goal',
] as const;
export type TrelMethod = (typeof TREL_METHODS)[number];
