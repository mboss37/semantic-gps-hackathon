import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { PolicyCatalogCard } from '@/components/dashboard/policy-catalog-card';
import { PolicyCreateDialog } from '@/components/dashboard/policy-create-dialog';
import {
  DIMENSION_LABELS,
  POLICY_CATALOG,
  type PolicyDimension,
} from '@/lib/policies/catalog';

// Sprint 28 IA flip: Policies catalog is the only management surface.
// `?filter=applied` shows only builtins with at least one instance attached.
// `?builtin=<key>` lands the user on the catalog with the create dialog
// auto-opened for that builtin (Apply CTA from any catalog card). Each card
// hosts edit-in-place for its instances via `<PolicyEditDialog>`, no
// separate active page, no row-management surface.

export const dynamic = 'force-dynamic';

const DIMENSION_ORDER: PolicyDimension[] = [
  'hygiene',
  'identity',
  'rate',
  'time',
  'residency',
  'kill-switch',
  'idempotency',
];

type Mode = 'shadow' | 'enforce';

type PolicyRow = {
  id: string;
  name: string;
  builtin_key: string;
  config: Record<string, unknown>;
  enforcement_mode: Mode;
  created_at: string;
};

type AssignmentRow = {
  id: string;
  policy_id: string;
  server_id: string | null;
  tool_id: string | null;
};

type ServerRow = { id: string; name: string };

type ToolRowRaw = {
  id: string;
  name: string;
  server_id: string;
  servers: { name: string } | null;
};

type SearchParams = {
  filter?: string | string[];
  builtin?: string | string[];
};

const PoliciesPage = async ({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/login?next=/dashboard/policies');
    }
    throw e;
  }
  const { supabase, organization_id } = ctx;

  const params = (await searchParams) ?? {};
  const filterParam = typeof params.filter === 'string' ? params.filter : 'all';
  const filter = filterParam === 'applied' ? 'applied' : 'all';
  const initialBuiltinKey =
    typeof params.builtin === 'string' && params.builtin.length > 0 ? params.builtin : undefined;

  const [policiesRes, assignmentsRes, serversRes, toolsRes] = await Promise.all([
    supabase
      .from('policies')
      .select('id, name, builtin_key, config, enforcement_mode, created_at')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('policy_assignments')
      .select('id, policy_id, server_id, tool_id')
      .eq('organization_id', organization_id),
    supabase
      .from('servers')
      .select('id, name')
      .eq('organization_id', organization_id),
    supabase
      .from('tools')
      .select('id, name, server_id, servers!inner(name, organization_id)')
      .eq('servers.organization_id', organization_id)
      .order('name'),
  ]);

  const policies = (policiesRes.data ?? []) as PolicyRow[];
  const assignments = (assignmentsRes.data ?? []) as AssignmentRow[];
  const servers = (serversRes.data ?? []) as ServerRow[];
  const toolsRaw = (toolsRes.data ?? []) as unknown as ToolRowRaw[];
  const tools = toolsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    server_id: t.server_id,
    server_name: t.servers?.name ?? 'unknown',
  }));

  const instancesByBuiltin = new Map<string, PolicyRow[]>();
  for (const p of policies) {
    const bucket = instancesByBuiltin.get(p.builtin_key) ?? [];
    bucket.push(p);
    instancesByBuiltin.set(p.builtin_key, bucket);
  }
  const assignmentsByPolicy = new Map<string, AssignmentRow[]>();
  for (const a of assignments) {
    const bucket = assignmentsByPolicy.get(a.policy_id) ?? [];
    bucket.push(a);
    assignmentsByPolicy.set(a.policy_id, bucket);
  }

  const totalApplied = policies.length;
  const totalAvailable = POLICY_CATALOG.length;

  const visibleEntries = POLICY_CATALOG.filter((entry) =>
    filter === 'applied' ? (instancesByBuiltin.get(entry.builtin_key)?.length ?? 0) > 0 : true,
  );

  const byDimension = new Map<PolicyDimension, typeof POLICY_CATALOG>();
  for (const entry of visibleEntries) {
    const bucket = byDimension.get(entry.dimension) ?? [];
    bucket.push(entry);
    byDimension.set(entry.dimension, bucket);
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold">Policies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Twelve gateway policies across seven governance dimensions. Apply one to your org -
            shadow mode first, then flip to enforce when the timeline looks clean.
          </p>
        </div>
        <FilterTabs filter={filter} totalAvailable={totalAvailable} totalApplied={totalApplied} />
      </header>

      {/* URL-driven create dialog. `?builtin=<key>` deep-links here from any
          card's "Apply to my org" CTA. The `key` prop forces a remount on URL
          change so the dialog's `useState(Boolean(initialBuiltinKey))`
          initializer re-runs and reopens, without this, same-page client
          navigation preserves the (false) initial state. */}
      <PolicyCreateDialog
        key={initialBuiltinKey ?? 'idle'}
        servers={servers}
        initialBuiltinKey={initialBuiltinKey}
        hideTrigger
      />

      {visibleEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No policies applied yet. Switch to{' '}
            <Link
              href="/dashboard/policies"
              className="text-foreground underline underline-offset-2 hover:text-foreground/80"
            >
              All
            </Link>{' '}
            to browse the catalog and apply one.
          </p>
        </div>
      ) : (
        <PolicyDimensionLayout
          byDimension={byDimension}
          instancesByBuiltin={instancesByBuiltin}
          assignmentsByPolicy={assignmentsByPolicy}
          servers={servers}
          tools={tools}
        />
      )}
    </div>
  );
};

export default PoliciesPage;

const FilterTabs = ({
  filter,
  totalAvailable,
  totalApplied,
}: {
  filter: 'all' | 'applied';
  totalAvailable: number;
  totalApplied: number;
}) => (
  <div className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/30 p-1">
    <FilterPill href="/dashboard/policies?filter=all" active={filter === 'all'} label="All" count={totalAvailable} />
    <FilterPill
      href="/dashboard/policies?filter=applied"
      active={filter === 'applied'}
      label="Applied"
      count={totalApplied}
    />
  </div>
);

const FilterPill = ({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) => (
  <Link
    href={href}
    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
      active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    {label}
    <span
      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
        active ? 'bg-muted text-foreground' : 'text-muted-foreground/80'
      }`}
    >
      {count}
    </span>
  </Link>
);

// Group catalog entries by dimension; render multi-card dimensions
// (`hygiene` + `identity`) as full-width sections, then pack singleton
// dimensions (rate / time / residency / kill-switch / idempotency) into one
// shared 3-col grid so the layout doesn't degenerate into a column of
// solo cards.
const PolicyDimensionLayout = ({
  byDimension,
  instancesByBuiltin,
  assignmentsByPolicy,
  servers,
  tools,
}: {
  byDimension: Map<PolicyDimension, typeof POLICY_CATALOG>;
  instancesByBuiltin: Map<string, PolicyRow[]>;
  assignmentsByPolicy: Map<string, AssignmentRow[]>;
  servers: ServerRow[];
  tools: Array<{ id: string; name: string; server_id: string; server_name: string }>;
}) => {
  const dimsWithEntries = DIMENSION_ORDER.filter((dim) => (byDimension.get(dim)?.length ?? 0) > 0);
  const multiCardDims = dimsWithEntries.filter((dim) => (byDimension.get(dim)?.length ?? 0) > 1);
  const singleCardDims = dimsWithEntries.filter((dim) => (byDimension.get(dim)?.length ?? 0) === 1);

  return (
    <div className="flex flex-col gap-8">
      {multiCardDims.map((dim) => {
        const entries = byDimension.get(dim) ?? [];
        return (
          <section key={dim} className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {DIMENSION_LABELS[dim]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <PolicyCatalogCard
                  key={entry.builtin_key}
                  entry={entry}
                  instances={instancesByBuiltin.get(entry.builtin_key) ?? []}
                  assignmentsByPolicy={assignmentsByPolicy}
                  servers={servers}
                  tools={tools}
                />
              ))}
            </div>
          </section>
        );
      })}

      {singleCardDims.length > 0 && (
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {singleCardDims.map((dim) => {
            const entry = (byDimension.get(dim) ?? [])[0];
            if (!entry) return null;
            return (
              <section key={dim} className="flex flex-col gap-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {DIMENSION_LABELS[dim]}
                </h2>
                <PolicyCatalogCard
                  entry={entry}
                  instances={instancesByBuiltin.get(entry.builtin_key) ?? []}
                  assignmentsByPolicy={assignmentsByPolicy}
                  servers={servers}
                  tools={tools}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
