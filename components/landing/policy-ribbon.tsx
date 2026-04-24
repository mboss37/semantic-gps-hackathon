import { Badge } from '@/components/ui/badge';

// 12 policy pills grouped by governance dimension. Proves the "12 across 7"
// stat claim visually. One dot-colour per dimension = at-a-glance grouping
// without a separate legend. Used inside Pillar 2.

type Policy = {
  key: string;
  dimension: 'hygiene' | 'identity' | 'rate' | 'time' | 'residency' | 'kill' | 'idempotency';
};

const POLICIES: Policy[] = [
  { key: 'pii_redaction', dimension: 'hygiene' },
  { key: 'injection_guard', dimension: 'hygiene' },
  { key: 'allowlist', dimension: 'identity' },
  { key: 'basic_auth', dimension: 'identity' },
  { key: 'client_id', dimension: 'identity' },
  { key: 'ip_allowlist', dimension: 'identity' },
  { key: 'agent_identity_required', dimension: 'identity' },
  { key: 'rate_limit', dimension: 'rate' },
  { key: 'business_hours', dimension: 'time' },
  { key: 'geo_fence', dimension: 'residency' },
  { key: 'write_freeze', dimension: 'kill' },
  { key: 'idempotency_required', dimension: 'idempotency' },
];

const DOT_COLOR: Record<Policy['dimension'], string> = {
  hygiene: 'bg-emerald-500',
  identity: 'bg-[var(--brand)]',
  rate: 'bg-cyan-500',
  time: 'bg-violet-500',
  residency: 'bg-pink-500',
  kill: 'bg-red-500',
  idempotency: 'bg-amber-500',
};

export const PolicyRibbon = () => (
  <div className="flex flex-wrap gap-2 pt-6">
    {POLICIES.map((p) => (
      <Badge
        key={p.key}
        variant="outline"
        className="gap-2 px-3 py-1 text-xs font-mono"
      >
        <span className={`size-1.5 rounded-full ${DOT_COLOR[p.dimension]}`} />
        {p.key}
      </Badge>
    ))}
  </div>
);
