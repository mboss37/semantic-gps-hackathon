import { z } from 'zod';

export const auditEventSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  server_id: z.string().nullable(),
  server_name: z.string().nullable(),
  tool_name: z.string().nullable(),
  method: z.string(),
  status: z.string(),
  latency_ms: z.number().nullable(),
  created_at: z.string(),
  policy_decisions: z.array(z.record(z.string(), z.unknown())).default([]),
  payload_redacted: z.unknown().nullable().optional(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
