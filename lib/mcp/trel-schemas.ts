import { z } from 'zod';

// Typed Relationships — non-standard JSON-RPC methods exposed on /api/mcp
// alongside the MCP builtins. They share the auth + policy + audit stack
// with tools/call because they flow through the same McpServer.

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

export type DiscoverRelationshipsParams = z.infer<
  typeof DiscoverRelationshipsRequestSchema
>['params'];
export type FindWorkflowPathParams = z.infer<
  typeof FindWorkflowPathRequestSchema
>['params'];

export const TREL_METHODS = ['discover_relationships', 'find_workflow_path'] as const;
export type TrelMethod = (typeof TREL_METHODS)[number];
