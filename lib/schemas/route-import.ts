import { z } from 'zod';

// Sprint 28 WP-28.1: route + steps JSON import shape.
//
// Tool references are name-based (server_name + tool_name) so the same JSON
// is portable across orgs. Resolution happens at import time against the
// caller's org. The seed shape in scripts/bootstrap-local-demo.sql is a
// SQL-flavored variant of this; lib/routes/import.ts converts and persists.

const JsonRecord = z.record(z.string(), z.unknown());

export const RouteStepImportSchema = z.object({
  step_order: z.number().int().positive(),
  server_name: z.string().min(1),
  tool_name: z.string().min(1),
  input_mapping: JsonRecord,
  output_capture_key: z.string().min(1).nullable().optional(),
  rollback_server_name: z.string().min(1).nullable().optional(),
  rollback_tool_name: z.string().min(1).nullable().optional(),
  rollback_input_mapping: JsonRecord.nullable().optional(),
  fallback_input_mapping: JsonRecord.nullable().optional(),
  fallback_rollback_input_mapping: JsonRecord.nullable().optional(),
});

export const RouteImportSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().nullable().optional(),
    domain_id: z.string().uuid().nullable().optional(),
    steps: z.array(RouteStepImportSchema).min(1),
  })
  .superRefine((data, ctx) => {
    // step_order must be unique within a route. The DB has UNIQUE
    // (route_id, step_order) but catching this at validation time gives
    // a precise 400 instead of a generic 500 on insert.
    const seen = new Set<number>();
    for (const step of data.steps) {
      if (seen.has(step.step_order)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate step_order ${step.step_order}`,
          path: ['steps'],
        });
        return;
      }
      seen.add(step.step_order);
    }
    // Either both rollback fields or neither. Half-specified rollback
    // would mean the import either silently drops the rollback or
    // creates a step with mismatched references.
    for (const step of data.steps) {
      const hasServer = Boolean(step.rollback_server_name);
      const hasTool = Boolean(step.rollback_tool_name);
      if (hasServer !== hasTool) {
        ctx.addIssue({
          code: 'custom',
          message:
            'rollback_server_name and rollback_tool_name must be set together or both omitted',
          path: ['steps'],
        });
        return;
      }
    }
  });

export type RouteImport = z.infer<typeof RouteImportSchema>;
export type RouteStepImport = z.infer<typeof RouteStepImportSchema>;
