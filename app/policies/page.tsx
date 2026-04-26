import type { Metadata } from 'next';
import { ShieldCheckIcon } from 'lucide-react';

import { FooterSection } from '@/components/landing/footer-section';
import { Navigation } from '@/components/landing/navigation';
import {
  type CatalogEntry,
  DIMENSION_LABELS,
  POLICY_CATALOG,
  type PolicyDimension,
} from '@/lib/policies/catalog';

type Group = {
  dimension: PolicyDimension;
  label: string;
  lede: string;
  policies: CatalogEntry[];
};
type Row =
  | { kind: 'full'; group: Group }
  | { kind: 'pair'; groups: [Group, Group?] };

// Public-facing policy catalog. Renders the 12 builtins from
// `lib/policies/catalog.ts` (single source of truth — same data the
// dashboard's authoring UI consumes). Grouped by governance dimension so the
// EU AI Act Article 9 "documented risk-management catalog" claim from
// `docs/VISION.md` has a public surface to point at. Each builtin gets an
// `id={builtin_key}` so the landing's incident cards can deep-link via
// `/policies#write_freeze`, `/policies#injection_guard`, etc.

export const metadata: Metadata = {
  title: 'Policy catalog',
  description:
    'The 12 gateway-native policies across 7 governance dimensions. Time, rate, identity, residency, hygiene, kill-switches, idempotency. The risk-management catalog the EU AI Act calls for.',
};

const DIMENSION_ORDER: PolicyDimension[] = [
  'hygiene',
  'identity',
  'kill-switch',
  'time',
  'rate',
  'residency',
  'idempotency',
];

const DIMENSION_LEDES: Record<PolicyDimension, string> = {
  hygiene: 'Scrub PII and prompt-injection payloads before they reach the agent or upstream.',
  identity: 'Restrict who and what can call. Header allowlists, basic auth, agent identity.',
  'kill-switch': 'One-flag stops. The Replit "code freeze" that should have been a guard.',
  time: 'Time-window gates. Business hours, maintenance freezes, weekend writes.',
  rate: 'Cap calls per minute to protect downstream systems from runaway agents.',
  residency: 'Data-residency gates. EU AI Act geo-fence hooks for cross-region calls.',
  idempotency: 'Require idempotency keys on writes; dedupe replays inside the TTL window.',
};

const grouped: Group[] = DIMENSION_ORDER.map((dimension) => ({
  dimension,
  label: DIMENSION_LABELS[dimension],
  lede: DIMENSION_LEDES[dimension],
  policies: POLICY_CATALOG.filter((p) => p.dimension === dimension),
})).filter((group) => group.policies.length > 0);

// Multi-policy dimensions get a full-width section. Single-policy dimensions
// are paired into 2-col rows so the page doesn't look like a column of
// orphaned cards. A trailing solo single (odd count) renders as its own row.
const buildRows = (groups: Group[]): Row[] => {
  const rows: Row[] = [];
  let pending: Group | null = null;
  for (const g of groups) {
    if (g.policies.length > 1) {
      if (pending) {
        rows.push({ kind: 'pair', groups: [pending] });
        pending = null;
      }
      rows.push({ kind: 'full', group: g });
    } else if (pending) {
      rows.push({ kind: 'pair', groups: [pending, g] });
      pending = null;
    } else {
      pending = g;
    }
  }
  if (pending) rows.push({ kind: 'pair', groups: [pending] });
  return rows;
};

const rows = buildRows(grouped);

const PolicyCard = ({ policy }: { policy: CatalogEntry }) => (
  <article
    id={policy.builtin_key}
    className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl scroll-mt-32 transition duration-300 hover:border-white/24 hover:bg-white/[0.035]"
  >
    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/28 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

    <div className="mb-4 flex items-center gap-2">
      <span className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-white/4 text-blue-100/85">
        <ShieldCheckIcon className="size-4" />
      </span>
      <code className="rounded-md border border-white/10 bg-white/4 px-2 py-1 font-mono text-[11px] text-white/70">
        {policy.builtin_key}
      </code>
    </div>

    <h3 className="mb-3 text-lg leading-tight font-semibold tracking-[-0.015em] text-white">
      {policy.title}
    </h3>
    <p className="mb-5 text-sm leading-6 text-white/55">{policy.description}</p>

    <div className="mt-auto border-t border-white/10 pt-4">
      <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-white/38 uppercase">
        Config
      </p>
      <div className="flex flex-wrap gap-1.5">
        {policy.config_keys.map((key) => (
          <code
            key={key}
            className="rounded-md border border-white/10 bg-white/4 px-2 py-0.5 font-mono text-[11px] text-white/65"
          >
            {key}
          </code>
        ))}
      </div>
    </div>
  </article>
);

const FullHeader = ({ group }: { group: Group }) => (
  <div className="mb-6 flex flex-col gap-2 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between md:gap-8">
    <div>
      <p className="mb-2 font-mono text-[11px] tracking-[0.22em] text-blue-100/55 uppercase">
        {group.dimension}
      </p>
      <h2 className="text-2xl leading-tight font-semibold tracking-[-0.025em] text-white md:text-3xl">
        {group.label}
      </h2>
    </div>
    <p className="max-w-xl text-sm leading-6 text-white/52">{group.lede}</p>
  </div>
);

const PairHeader = ({ group }: { group: Group }) => (
  <div className="mb-5 border-b border-white/10 pb-4">
    <p className="mb-1.5 font-mono text-[10px] tracking-[0.22em] text-blue-100/55 uppercase">
      {group.dimension}
    </p>
    <h2 className="mb-1.5 text-xl leading-tight font-semibold tracking-[-0.02em] text-white">
      {group.label}
    </h2>
    <p className="text-[13px] leading-5 text-white/52">{group.lede}</p>
  </div>
);

const PoliciesPage = () => (
  <main className="noise-overlay relative min-h-screen overflow-x-hidden bg-[#02040a] text-white">
    <Navigation />

    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(125,211,252,0.06),transparent_42%)]" />
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <div className="max-w-3xl">
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-blue-100/55 uppercase">
            Policy catalog
          </p>
          <h1 className="text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance text-white md:text-6xl">
            Twelve gateway-native policies. Seven governance dimensions.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">
            Every policy below ships with the gateway. Each runs in shadow first (observe), then
            flips to enforce (block) on a single column write &mdash; no agent restart, no upstream
            redeploy. Together they form the documented risk-management catalog the EU AI Act&rsquo;s
            Article 9 calls for.
          </p>
        </div>
      </div>
    </section>

    <section className="relative pb-24 md:pb-32">
      <div className="mx-auto max-w-[1240px] space-y-16 px-5 md:px-8">
        {rows.map((row, i) => {
          if (row.kind === 'full') {
            return (
              <div key={row.group.dimension}>
                <FullHeader group={row.group} />
                <div className="grid gap-4 md:grid-cols-2">
                  {row.group.policies.map((policy) => (
                    <PolicyCard key={policy.builtin_key} policy={policy} />
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={`pair-${i}`} className="grid gap-x-8 gap-y-10 md:grid-cols-2">
              {row.groups
                .filter((g): g is Group => Boolean(g))
                .map((g) => (
                  <div key={g.dimension}>
                    <PairHeader group={g} />
                    <PolicyCard policy={g.policies[0]} />
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </section>

    <FooterSection />
  </main>
);

export default PoliciesPage;
