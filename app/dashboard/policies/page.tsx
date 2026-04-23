import { createClient } from '@/lib/supabase/server';
import { PolicyCreateDialog } from '@/components/dashboard/policy-create-dialog';
import { PolicyRow } from '@/components/dashboard/policy-row';

export const dynamic = 'force-dynamic';

type PolicyRecord = {
  id: string;
  name: string;
  builtin_key:
    | 'pii_redaction'
    | 'rate_limit'
    | 'allowlist'
    | 'injection_guard'
    | 'basic_auth'
    | 'client_id'
    | 'ip_allowlist'
    | 'business_hours'
    | 'write_freeze';
  config: Record<string, unknown>;
  enforcement_mode: 'shadow' | 'enforce';
  created_at: string;
};

type AssignmentRecord = {
  id: string;
  policy_id: string;
  server_id: string | null;
  tool_id: string | null;
};

type ServerRecord = { id: string; name: string };

type ToolRowRaw = {
  id: string;
  name: string;
  server_id: string;
  servers: { name: string } | null;
};

type ToolOption = {
  id: string;
  name: string;
  server_id: string;
  server_name: string;
};

const PoliciesPage = async () => {
  const supabase = await createClient();
  // Tools are org-scoped by joining through `servers` (which has
  // organization_id). RLS is off in the MVP, but the user-scoped Supabase
  // client still gets everything — we filter client-side by the servers we
  // already pulled. Keeps this page parallel with the rest of the dashboard.
  const [policiesRes, assignmentsRes, serversRes, toolsRes] = await Promise.all([
    supabase
      .from('policies')
      .select('id, name, builtin_key, config, enforcement_mode, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('policy_assignments').select('id, policy_id, server_id, tool_id'),
    supabase.from('servers').select('id, name'),
    supabase
      .from('tools')
      .select('id, name, server_id, servers!inner(name)')
      .order('name'),
  ]);

  const policies = (policiesRes.data ?? []) as PolicyRecord[];
  const assignments = (assignmentsRes.data ?? []) as AssignmentRecord[];
  const servers = (serversRes.data ?? []) as ServerRecord[];
  const toolsRaw = (toolsRes.data ?? []) as unknown as ToolRowRaw[];
  const tools: ToolOption[] = toolsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    server_id: t.server_id,
    server_name: t.servers?.name ?? 'unknown',
  }));

  const assignmentsByPolicy = new Map<string, AssignmentRecord[]>();
  for (const a of assignments) {
    const bucket = assignmentsByPolicy.get(a.policy_id) ?? [];
    bucket.push(a);
    assignmentsByPolicy.set(a.policy_id, bucket);
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Policies</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Shadow mode logs decisions; enforce mode blocks or redacts. Toggle mid-call — next
            gateway invocation picks up the change.
          </p>
        </div>
        <PolicyCreateDialog servers={servers} />
      </header>

      {policies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">No policies yet.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Start with <span className="text-zinc-200">pii_redaction</span> in shadow mode against
            the demo server.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {policies.map((p) => (
            <PolicyRow
              key={p.id}
              id={p.id}
              name={p.name}
              builtinKey={p.builtin_key}
              config={p.config}
              mode={p.enforcement_mode}
              assignments={assignmentsByPolicy.get(p.id) ?? []}
              servers={servers}
              tools={tools}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PoliciesPage;
