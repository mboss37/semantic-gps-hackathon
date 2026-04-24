import Link from 'next/link';
import { Suspense } from 'react';
import { PlayIcon, ArrowRightIcon, SparklesIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { ArchitectureDiagram } from '@/components/landing/architecture-diagram';
import { Footer } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import { NavBar } from '@/components/landing/nav-bar';
import { Pillar, type PillarFeature } from '@/components/landing/pillar';
import {
  Pillar1Visual,
  Pillar2Visual,
  Pillar3Visual,
  Pillar4Visual,
} from '@/components/landing/pillar-visuals';
import { Reveal } from '@/components/landing/reveal';
import { StatStrip } from '@/components/landing/stat-strip';
import { VideoSection } from '@/components/landing/video-section';

import { VerifiedHandler } from './verified-handler';

export const metadata = {
  title: 'Semantic GPS — Governance for agentic workflows',
  description:
    'A gateway that sits between the agent and real tools, redacting data, blocking calls, and rolling back broken workflows.',
};

// Sprint 18: landing page assembled from specialist prework at
// `.claude/state/sprint-18-*.md`. Every feature claim traces to a shipped WP
// in TASKS.md § Completed Sprints. Dark-mode-only, zero external image deps.

const PILLAR_1_FEATURES: PillarFeature[] = [
  {
    title: 'Redact PII before the agent reads it',
    detail:
      'Scrub real phone numbers, emails, and card patterns out of tool responses before the agent context ever sees them.',
  },
  {
    title: 'Block prompt injection at the gateway',
    detail: 'Stop malicious control strings before they reach the upstream tool, not after.',
  },
  {
    title: 'Flip shadow to enforce in one click',
    detail: 'No restart, no redeploy. Next gateway call obeys the new mode.',
  },
  {
    title: 'Review seven days of decisions',
    detail: 'Stacked Recharts show allow, shadow-block, and enforce-block counts per policy.',
  },
];

const PILLAR_2_FEATURES: PillarFeature[] = [
  {
    title: 'Apply any of twelve built-in policies',
    detail: 'Browse a Mulesoft-style catalog grouped by governance dimension.',
  },
  {
    title: 'Gate on time, rate, identity, or IP',
    detail: 'Per tool or per org. Shadow first, enforce when the audit is clean.',
  },
  {
    title: 'Require agent identity on every call',
    detail: 'The gateway never runs for an unidentified caller.',
  },
  {
    title: 'Compare raw and governed in a live A/B',
    detail: 'Same Opus 4.7 agent, same prompt. Extended-thinking blocks rendered on both panes.',
  },
];

const PILLAR_3_FEATURES: PillarFeature[] = [
  {
    title: 'Walk compensated_by edges in reverse',
    detail: 'Declare undo paths once. The gateway runs them when a multi-step workflow halts.',
  },
  {
    title: 'Map compensator arguments per step',
    detail: 'Undo calls get correctly-shaped inputs, not raw producer results.',
  },
  {
    title: 'Fall back to an alternative tool chain',
    detail: 'On origin error, the gateway walks the fallback edge and logs fallback_triggered.',
  },
  {
    title: 'Build on eight typed relationships',
    detail:
      'produces_input_for, requires_before, suggests_after, mutually_exclusive, validates, alternative_to, compensated_by, fallback_to.',
  },
];

const PILLAR_4_FEATURES: PillarFeature[] = [
  {
    title: 'Replay any workflow from the audit log',
    detail: 'Filter by scope, time, or trace to walk a single saga end to end.',
  },
  {
    title: 'Read three live charts',
    detail: 'Call volume, policy blocks per rule, PII detections per pattern.',
  },
  {
    title: 'Point agents at any scope',
    detail: 'One org URL, one per-domain URL, one per-server URL. All honest tools/list.',
  },
  {
    title: 'Row-level security on thirteen tables',
    detail: 'Defense in depth: a cross-org UUID guess returns empty at the DB layer.',
  },
];

const OBJECTIONS = [
  {
    q: 'How is this different from Kong, Zuplo, Tyk, or Apigee?',
    a: 'Those route HTTP endpoints. This routes tool intents. The unit of governance is a typed tool call with a declared input and output graph, not a URL path. Policies read tool arguments and responses, like PII in a Salesforce field or injection in an issue body, not just headers and query strings.',
  },
  {
    q: "Isn't this just Salesforce Agentforce with extra steps?",
    a: 'Agentforce governs agent behaviour inside a Salesforce org. This governs the outbound hop when an agent spans Salesforce, Slack, GitHub, and internal APIs in the same workflow. The hero demo crosses three upstreams in one saga, which is the surface Agentforce does not cover.',
  },
  {
    q: 'Where is the moat if policies are just config?',
    a: 'The moat is the typed relationship graph plus saga rollback. No other MCP gateway ships compensated_by edges with per-step rollback input mapping. Config-level policies are table stakes. Typed-graph orchestration with best-effort saga honesty is the hard part.',
  },
];

const Objections = () => (
  <section className="py-24 md:py-28 border-t border-border/50">
    <div className="max-w-5xl mx-auto px-6 lg:px-8 flex flex-col gap-12">
      <Reveal>
        <div className="flex flex-col gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)]">
            Objections answered
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            The questions a technical judge will ask.
          </h2>
        </div>
      </Reveal>
      <div className="flex flex-col gap-6">
        {OBJECTIONS.map((item, i) => (
          <Reveal key={item.q} delay={i * 80}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">{item.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {item.a}
                </p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const ArchitectureSection = () => (
  <section className="py-24 md:py-28 border-t border-border/50">
    <div className="max-w-5xl mx-auto px-6 lg:px-8 flex flex-col gap-10 items-center">
      <Reveal>
        <div className="flex flex-col gap-3 text-center max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)]">
            How it fits together
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            A control plane for any MCP agent.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            The gateway sits between the agent loop and the real tools. Look for the manifest
            cache, the policy engine gate at every call, and the reverse walk of{' '}
            <code className="font-mono text-sm px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
              compensated_by
            </code>{' '}
            edges when a route halts mid-way.
          </p>
        </div>
      </Reveal>
      <Reveal className="w-full" delay={120}>
        <div className="rounded-xl border border-border bg-card/50 p-6 md:p-10">
          <ArchitectureDiagram />
        </div>
      </Reveal>
    </div>
  </section>
);

const CtaBand = () => (
  <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
    <div
      className="relative overflow-hidden rounded-2xl border border-border/50 px-10 py-16 md:px-16 md:py-20"
      style={{
        background:
          'linear-gradient(to bottom right, oklch(0.62 0.22 267 / 0.15), oklch(0.19 0.02 260), oklch(0.14 0.01 260))',
      }}
    >
      <div
        className="absolute top-0 left-0 w-96 h-96 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, oklch(0.62 0.22 267 / 0.3), transparent 60%)' }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center text-center gap-6">
        <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
          <SparklesIcon className="size-3 text-[var(--brand)]" />
          Live, hosted, Opus 4.7 on both panes
        </Badge>
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
          Run the same agent with and without the gateway.
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
          Watch a leak. Flip a column. Watch it stop. One prompt, two panes, one governance decision.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            asChild
            size="lg"
            className="h-12 px-6 text-base font-semibold bg-[var(--brand)] text-white shadow-[0_8px_24px_-8px_var(--brand)] hover:bg-[var(--brand)]/90"
          >
            <Link href="#demo-video">
              <PlayIcon className="size-4" />
              Watch the 3-minute demo
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
            <Link href="/signup">
              Try the Playground
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

const Home = () => (
  <main className="min-h-screen bg-background text-foreground">
    <Suspense fallback={null}>
      <VerifiedHandler />
    </Suspense>
    <NavBar />
    <Hero />
    <StatStrip />
    <Pillar
      id="pillar-1"
      eyebrow="Impact · stop the leak"
      title="Stop the leak"
      lede="PII never enters the agent's context when the gateway is between them. Shadow-observe for a week, then flip a column and start blocking."
      features={PILLAR_1_FEATURES}
      visual={<Pillar1Visual />}
      side="text-left"
      accent="#ef4444"
    />
    <Pillar
      id="pillar-2"
      eyebrow="Opus 4.7 · govern the call"
      title="Govern the call, not the data"
      lede="Twelve gateway-native policies decide who calls what, when, from where, and whether the arguments are safe. Agent frameworks keep the data rules."
      features={PILLAR_2_FEATURES}
      visual={<Pillar2Visual />}
      side="text-right"
      accent="oklch(0.62 0.22 267)"
    />
    <Pillar
      id="pillar-3"
      eyebrow="Depth · recover cleanly"
      title="Recover when agents fail"
      lede="Typed relationships tell the gateway how tools connect. When a multi-step workflow halts mid-way, it walks the graph in reverse and undoes the completed steps."
      features={PILLAR_3_FEATURES}
      visual={<Pillar3Visual />}
      side="text-left"
      accent="#f59e0b"
    />
    <Pillar
      id="pillar-4"
      eyebrow="Demo · prove it happened"
      title="Prove it happened"
      lede="Every call lands in the audit log with trace ID, policy decisions, and latency. Charts over the events table turn the log into a dashboard a compliance team can read."
      features={PILLAR_4_FEATURES}
      visual={<Pillar4Visual />}
      side="text-right"
      accent="#22c55e"
    />
    <ArchitectureSection />
    <div id="demo-video">
      <VideoSection />
    </div>
    <Objections />
    <CtaBand />
    <Footer />
  </main>
);

export default Home;
