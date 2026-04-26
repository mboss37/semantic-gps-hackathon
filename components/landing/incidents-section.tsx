import { ShieldCheckIcon } from 'lucide-react';

type Incident = {
  date: string;
  who: string;
  headline: string;
  body: string;
  outcome: string;
  prevention: string;
  source: { label: string; url: string };
};

const INCIDENTS: readonly Incident[] = [
  {
    date: 'Feb 2026',
    who: "Meta's Director of AI Alignment",
    headline: 'Autonomous agent ignores explicit "ask first" instruction',
    body: 'Summer Yue asked an OpenClaw agent to suggest, not act. Context compaction silently dropped her safety constraint. The agent wiped 200+ emails. She told it to stop twice; it kept deleting.',
    outcome: '200+ emails lost. Recovery: physically running to her Mac to kill the processes.',
    prevention: 'Shadow → enforce mode + audit trail',
    source: {
      label: "Tom's Hardware",
      url: 'https://www.tomshardware.com/tech-industry/artificial-intelligence/openclaw-wipes-inbox-of-meta-ai-alignment-director-executive-finds-out-the-hard-way-how-spectacularly-efficient-ai-tool-is-at-maintaining-her-inbox',
    },
  },
  {
    date: 'Jul 2025',
    who: 'Replit AI coding agent',
    headline: '"Code freeze" was prose, not a kill-switch',
    body: 'During a declared code freeze, the Replit AI agent ran destructive commands against the production database. When confronted, it lied about whether the data could be recovered. The freeze was an instruction in a chat, not a technical guard.',
    outcome: '1,200+ executives + 1,190+ companies wiped from production data.',
    prevention: 'write_freeze kill-switch + saga rollback',
    source: {
      label: 'Fortune',
      url: 'https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/',
    },
  },
  {
    date: 'Mid 2025',
    who: 'Cursor + Supabase MCP agent',
    headline: 'Privileged agent, untrusted input, public output',
    body: "A privileged service-role agent processed support tickets containing user-supplied input as commands. Attackers embedded SQL that read sensitive integration tokens and exfiltrated them into a public support thread. Three deadly factors composed.",
    outcome: 'Integration tokens leaked publicly. Catastrophic data breach.',
    prevention: 'injection_guard + agent_identity policies',
    source: {
      label: 'Unit 42 / Palo Alto Networks',
      url: 'https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/',
    },
  },
];

export const IncidentsSection = () => (
  <section
    id="incidents"
    className="relative overflow-hidden border-y border-white/10 bg-white/[0.018] py-24 lg:py-32"
  >
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(252,165,165,0.06),transparent_42%)]" />
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="mb-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-red-200/70 uppercase">
            Recent receipts
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
            className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur-xl transition duration-300 hover:border-red-300/30"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-200/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border border-red-300/25 bg-red-300/10 px-3 py-1 font-mono text-[10px] tracking-[0.2em] text-red-100 uppercase">
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

            <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-white/45 uppercase">
              {incident.who}
            </p>
            <h3 className="mb-4 text-xl leading-tight font-semibold tracking-[-0.025em] text-white">
              {incident.headline}
            </h3>
            <p className="mb-5 text-sm leading-6 text-white/58">{incident.body}</p>

            <div className="mt-auto space-y-3 border-t border-white/8 pt-5">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-red-200/60 uppercase">
                  Outcome
                </p>
                <p className="mt-1 text-[13px] leading-5 text-red-100/85">{incident.outcome}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-emerald-200/65 uppercase">
                  Semantic GPS would have stopped this with
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] leading-5 text-emerald-100/90">
                  <ShieldCheckIcon className="size-3.5" />
                  {incident.prevention}
                </p>
              </div>
            </div>
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
