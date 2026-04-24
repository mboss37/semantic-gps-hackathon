'use client';

import {
  ActivityIcon,
  GaugeIcon,
  GitMergeIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  NetworkIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';

type AuditRow = {
  ts: string;
  trace: string;
  server: 'salesforce' | 'slack' | 'github';
  tool: string;
  policy: string;
  status: 'ALLOW' | 'REDACT' | 'BLOCK' | 'SHADOW';
  latency: number;
};

const AUDIT_ROWS: readonly AuditRow[] = [
  { ts: '14:23:01.204', trace: 'b4a3f27e', server: 'salesforce', tool: 'find_account', policy: 'rate_limit', status: 'ALLOW', latency: 142 },
  { ts: '14:23:01.346', trace: 'b4a3f27e', server: 'salesforce', tool: 'get_contact', policy: 'pii_redaction', status: 'REDACT', latency: 89 },
  { ts: '14:23:01.435', trace: 'b4a3f27e', server: 'slack', tool: 'send_message', policy: 'business_hours', status: 'ALLOW', latency: 203 },
  { ts: '14:23:01.638', trace: 'b4a3f27e', server: 'github', tool: 'create_issue', policy: 'prompt_injection', status: 'BLOCK', latency: 44 },
  { ts: '14:23:01.749', trace: 'b4a3f27e', server: 'github', tool: 'close_issue', policy: 'compensated', status: 'ALLOW', latency: 67 },
  { ts: '14:22:58.012', trace: '8f11ac93', server: 'salesforce', tool: 'query_soql', policy: 'rate_limit', status: 'ALLOW', latency: 318 },
  { ts: '14:22:57.884', trace: '8f11ac93', server: 'salesforce', tool: 'update_lead', policy: 'trust_scope', status: 'ALLOW', latency: 112 },
  { ts: '14:22:57.441', trace: '2d09b81f', server: 'slack', tool: 'list_channels', policy: '—', status: 'ALLOW', latency: 58 },
  { ts: '14:22:57.103', trace: '2d09b81f', server: 'slack', tool: 'post_thread', policy: 'pii_redaction', status: 'SHADOW', latency: 176 },
  { ts: '14:22:56.820', trace: '6a72e4c1', server: 'github', tool: 'list_prs', policy: '—', status: 'ALLOW', latency: 91 },
  { ts: '14:22:56.512', trace: '6a72e4c1', server: 'github', tool: 'comment_on_pr', policy: 'prompt_injection', status: 'ALLOW', latency: 104 },
  { ts: '14:22:55.997', trace: '91d5ae4a', server: 'salesforce', tool: 'get_contact', policy: 'pii_redaction', status: 'REDACT', latency: 72 },
  { ts: '14:22:55.684', trace: '91d5ae4a', server: 'salesforce', tool: 'find_account', policy: 'rate_limit', status: 'ALLOW', latency: 135 },
];

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboardIcon, name: 'Dashboard' },
      { icon: GlobeIcon, name: 'Servers' },
      { icon: NetworkIcon, name: 'Workflow Graph' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { icon: RouteIcon, name: 'Routes' },
      { icon: SparklesIcon, name: 'Playground' },
      { icon: GitMergeIcon, name: 'Relationships' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { icon: ShieldCheckIcon, name: 'Policies' },
      { icon: LibraryIcon, name: 'Policy Catalog' },
    ],
  },
  {
    label: 'Observability',
    items: [
      { icon: GaugeIcon, name: 'Monitoring' },
      { icon: ActivityIcon, name: 'Audit', active: true },
    ],
  },
  {
    label: 'Auth',
    items: [{ icon: KeyRoundIcon, name: 'Tokens' }],
  },
] as const;

const SERVER_GLYPH = {
  salesforce: { label: 'SF', ring: 'ring-[oklch(0.56_0.18_254)]/40', bg: 'bg-[oklch(0.56_0.18_254)]/10' },
  slack: { label: 'SL', ring: 'ring-[oklch(0.68_0.2_330)]/40', bg: 'bg-[oklch(0.68_0.2_330)]/10' },
  github: { label: 'GH', ring: 'ring-foreground/20', bg: 'bg-foreground/5' },
} as const;

const STATUS_STYLE = {
  ALLOW: {
    dot: 'bg-[oklch(0.72_0.18_150)]',
    label: 'text-[oklch(0.78_0.18_150)]',
    bg: 'bg-[oklch(0.72_0.18_150)]/10 border-[oklch(0.72_0.18_150)]/25',
  },
  REDACT: {
    dot: 'bg-[oklch(0.78_0.16_85)]',
    label: 'text-[oklch(0.82_0.16_85)]',
    bg: 'bg-[oklch(0.78_0.16_85)]/10 border-[oklch(0.78_0.16_85)]/25',
  },
  BLOCK: {
    dot: 'bg-[#ff4d4f]',
    label: 'text-[#ff6b6d]',
    bg: 'bg-[#ff4d4f]/10 border-[#ff4d4f]/25',
  },
  SHADOW: {
    dot: 'bg-[var(--brand)]',
    label: 'text-[var(--brand)]',
    bg: 'bg-[var(--brand)]/10 border-[var(--brand)]/25',
  },
} as const;

export const DashboardMockup = () => (
  <div className="flex min-h-[520px] md:min-h-[640px] text-[13px]">
    {/* Sidebar */}
    <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-border bg-card/40">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
        <div className="w-4 h-4 rounded-[3px] bg-[var(--brand)] flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          Semantic GPS
        </span>
      </div>

      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background/60 border border-border">
          <div className="w-5 h-5 rounded bg-card border border-border flex items-center justify-center text-[9px] font-mono text-foreground/60">
            AC
          </div>
          <span className="text-[12px] text-foreground/85 truncate">Acme Corp</span>
          <span className="ml-auto text-foreground/30 text-[10px]">⌄</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1.5 text-[10px] uppercase tracking-[0.14em] font-medium text-foreground/35">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = 'active' in item && item.active;
                return (
                  <div
                    key={item.name}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12.5px] ${
                      active
                        ? 'bg-foreground text-background font-medium'
                        : 'text-foreground/65'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--brand)] to-[oklch(0.6_0.22_290)]" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-foreground/85 truncate">Mihael B.</p>
            <p className="text-[10px] text-foreground/45 truncate">admin · acme</p>
          </div>
        </div>
      </div>
    </aside>

    {/* Main */}
    <div className="flex-1 min-w-0 flex flex-col overflow-x-auto">
      <div className="min-w-[780px] flex-1 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground/80">Audit log</span>
          <span className="text-foreground/30">/</span>
          <span className="text-[13px] text-foreground/55">All events</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-foreground/55">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[oklch(0.72_0.18_150)] opacity-60 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_150)]" />
            </span>
            live
          </span>
          <div className="hidden md:flex items-center rounded-md border border-border bg-card/60 overflow-hidden">
            <button className="px-3 py-1 text-[11.5px] font-medium bg-foreground text-background">
              Organization
            </button>
            <button className="px-3 py-1 text-[11.5px] text-foreground/60">Workspace</button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-5 h-11 border-b border-border bg-background/80">
        <div className="flex items-center gap-2 flex-1 max-w-[320px] rounded-md border border-border bg-card/40 px-2.5 py-1.5">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-foreground/45" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="text-[11.5px] text-foreground/40 font-mono">trace_id:b4a3…</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-[11.5px] text-foreground/60">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-foreground/45" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Last 24h
        </div>
        <div className="hidden md:flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-[11.5px] text-foreground/60">
          Status: any
        </div>
        <div className="hidden lg:flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-[11.5px] text-foreground/60">
          Policy: any
        </div>
        <div className="flex-1" />
        <button className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11.5px] text-foreground/70 hover:bg-card/40">
          Export
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[100px_88px_60px_1fr_120px_90px_64px] gap-4 px-5 h-9 items-center border-b border-border bg-card/30 text-[10px] uppercase tracking-[0.1em] font-medium text-foreground/50">
        <div>Timestamp</div>
        <div>Trace</div>
        <div>Server</div>
        <div>Tool · Policy</div>
        <div>Status</div>
        <div className="text-right">Latency</div>
        <div />
      </div>

      {/* Rows */}
      <div className="relative flex-1 min-h-[440px]">
        {AUDIT_ROWS.map((row, i) => {
          const server = SERVER_GLYPH[row.server];
          const statusStyle = STATUS_STYLE[row.status];
          return (
            <div
              key={`${row.ts}-${row.tool}-${i}`}
              className="grid grid-cols-[100px_88px_60px_1fr_120px_90px_64px] gap-4 px-5 h-[42px] items-center border-b border-border/60 hover:bg-card/40 transition-colors text-[12px]"
            >
              <div className="font-mono tabular-nums text-foreground/55 text-[11px]">
                {row.ts}
              </div>
              <div className="font-mono text-foreground/50 text-[11px]">{row.trace}</div>
              <div>
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded ring-1 ${server.ring} ${server.bg} text-[9px] font-mono font-semibold text-foreground/70`}
                >
                  {server.label}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-foreground/90 truncate">{row.tool}</span>
                <span className="text-foreground/25 shrink-0">·</span>
                <span className="font-mono text-[11px] text-foreground/50 truncate">
                  {row.policy}
                </span>
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase tracking-[0.08em] font-medium ${statusStyle.bg} ${statusStyle.label}`}
                >
                  <span className={`w-1 h-1 rounded-full ${statusStyle.dot}`} />
                  {row.status}
                </span>
              </div>
              <div className="font-mono tabular-nums text-foreground/70 text-right text-[11px]">
                {row.latency}ms
              </div>
              <div className="text-right text-foreground/30">›</div>
            </div>
          );
        })}

        {/* Fade the bottom to suggest continuation */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-background" />
      </div>
      </div>
    </div>
  </div>
);
