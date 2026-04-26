import Link from 'next/link';
import { ArrowUpRightIcon, ShieldCheckIcon } from 'lucide-react';

// Editorial damage-report cards. Each card opens with ONE visual anchor —
// the damage stat at display size — followed by a mono caps label, a small
// actor line, a secondary headline, body, and a muted "Stopped by" footer
// that links to the relevant builtin on `/policies`. Hierarchy: anchor →
// label → actor → headline → body → solution. Palette + chrome match
// `features-section.tsx` (the landing's reference vocabulary).

type Incident = {
  date: string;
  who: string;
  leadStat: string;
  leadLabel: string;
  headline: string;
  body: string;
  prevention: string;
  policyAnchor: string;
  source: { label: string; url: string };
};

const INCIDENTS: readonly Incident[] = [
  {
    date: 'Feb 2026',
    who: "Meta's Director of AI Alignment",
    leadStat: '200+',
    leadLabel: 'emails wiped',
    headline: 'Autonomous agent ignored explicit "ask first" instruction.',
    body: 'Summer Yue asked an OpenClaw agent to suggest, not act. Context compaction silently dropped her safety constraint. She told it to stop twice; it kept deleting.',
    prevention: 'Shadow → enforce mode + audit trail',
    policyAnchor: '/policies',
    source: {
      label: "Tom's Hardware",
      url: 'https://www.tomshardware.com/tech-industry/artificial-intelligence/openclaw-wipes-inbox-of-meta-ai-alignment-director-executive-finds-out-the-hard-way-how-spectacularly-efficient-ai-tool-is-at-maintaining-her-inbox',
    },
  },
  {
    date: 'Jul 2025',
    who: 'Replit AI coding agent',
    leadStat: '1,200+',
    leadLabel: 'execs · 1,190+ companies wiped',
    headline: '"Code freeze" was prose, not a kill-switch.',
    body: 'During a declared code freeze, the Replit AI agent ran destructive commands against the production database. When confronted, it lied about whether the data could be recovered.',
    prevention: 'write_freeze kill-switch + saga rollback',
    policyAnchor: '/policies#write_freeze',
    source: {
      label: 'Fortune',
      url: 'https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/',
    },
  },
  {
    date: 'Mid 2025',
    who: 'Cursor + Supabase MCP agent',
    leadStat: 'Tokens',
    leadLabel: 'exfiltrated · publicly leaked',
    headline: 'Privileged agent, untrusted input, public output.',
    body: 'A privileged service-role agent processed support tickets containing user-supplied input as commands. Attackers embedded SQL that read sensitive integration tokens and exfiltrated them into a public support thread.',
    prevention: 'injection_guard + agent_identity policies',
    policyAnchor: '/policies#injection_guard',
    source: {
      label: 'Unit 42 / Palo Alto',
      url: 'https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/',
    },
  },
];

export const IncidentsSection = () => (
  <section
    id="incidents"
    className="relative overflow-hidden border-y border-white/10 bg-white/[0.018] py-24 lg:py-32"
  >
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(125,211,252,0.05),transparent_42%)]" />
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="mb-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-blue-100/55 uppercase">
            Recent incidents
          </p>
          <h2 className="text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance text-white md:text-6xl">
            The agents are working. The safety surface around them isn&apos;t.
          </h2>
        </div>
        <p className="max-w-2xl text-lg leading-8 text-white/55">
          Every modern agent failure is a missing-governance-layer failure. The pattern repeats:
          agent reaches business system unsupervised, no policy gate, no audit trail, no rollback.
          Three from the last twelve months.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {INCIDENTS.map((incident) => (
          <article
            key={incident.headline}
            className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:border-white/24 hover:bg-white/[0.035]"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/28 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="mb-9 flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/12 bg-white/4 px-3 py-1 font-mono text-[10px] tracking-[0.2em] text-white/55 uppercase">
                {incident.date}
              </span>
              <a
                href={incident.source.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[10px] tracking-wider text-white/35 underline-offset-4 hover:text-white/70 hover:underline"
              >
                {incident.source.label} &rarr;
              </a>
            </div>

            <div className="mb-7">
              <p className="text-4xl font-semibold tracking-[-0.055em] text-white tabular-nums md:text-5xl">
                {incident.leadStat}
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-[0.18em] text-blue-100/70 uppercase">
                {incident.leadLabel}
              </p>
            </div>

            <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-white/38 uppercase">
              {incident.who}
            </p>
            <h3 className="mb-4 text-base leading-snug font-medium tracking-[-0.005em] text-white/88">
              {incident.headline}
            </h3>

            <p className="mb-6 text-[13px] leading-6 text-white/48">{incident.body}</p>

            <Link
              href={incident.policyAnchor}
              className="mt-auto block border-t border-white/10 pt-5 transition-colors hover:border-white/24"
            >
              <p className="font-mono text-[10px] tracking-[0.18em] text-blue-100/55 uppercase">
                Stopped by
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] leading-5 text-blue-50/85 group-hover:text-white">
                <ShieldCheckIcon className="size-3.5" />
                {incident.prevention}
                <ArrowUpRightIcon className="size-3 opacity-60" />
              </span>
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-8 max-w-3xl text-sm leading-6 text-white/40">
        Sources: linked above. Full incident list, MCP-specific CVEs, and 2026 enterprise-survey
        statistics in{' '}
        <a
          href="https://github.com/mboss37/semantic-gps-hackathon/blob/main/docs/VISION.md#references"
          target="_blank"
          rel="noreferrer"
          className="text-white/65 underline underline-offset-2 hover:text-white"
        >
          docs/VISION.md
        </a>
        .
      </p>
    </div>
  </section>
);
