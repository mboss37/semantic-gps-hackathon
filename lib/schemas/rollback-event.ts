import { z } from 'zod';

// Shape written by `lib/mcp/execute-route.ts` when F.3 rollback fires.
// Tool NAMES (not ids) live in the payload because `logMCPEvent` already
// persists `tool_name` separately and the compensation tool is all we need
// to resolve the `compensated_by` edge back in the client.
export const rollbackEventSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  server_id: z.string().nullable(),
  tool_name: z.string().nullable(),
  created_at: z.string(),
  payload: z
    .object({
      original_tool: z.string().optional(),
      compensation_tool: z.string().optional(),
      original_step_order: z.number().optional(),
    })
    .passthrough()
    .nullable(),
});

export type RollbackEvent = z.infer<typeof rollbackEventSchema>;
