import Link from 'next/link';
import {
  PlayIcon,
  ArrowRightIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ActivityIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GithubMark } from '@/components/landing/github-mark';

// Hero section. Asymmetric 7/5 lg layout (copy left, media right). Dark
// layered gradient blobs for depth without glassmorphism. Primary CTA is the
// branded video button, not the grey shadcn default. Hero media falls back
// to an inline SVG A/B mock when no MP4 is configured — zero external asset
// dependency so the page always renders polished.

const HERO_VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

const HeroABMock = () => (
  <svg
    viewBox="0 0 800 500"
    role="img"
    aria-label="Split-pane Playground A/B. Left pane shows a Slack message with a customer phone number highlighted in red. Right pane shows the same message with the phone number replaced by a green redacted phone pill. Same agent, same prompt, one policy flipped to enforce."
    className="w-full h-full"
  >
    <rect width="800" height="500" fill="oklch(0.145 0 0)" />
    {[
      { x: 20, label: 'RAW MCP', pillStroke: 'oklch(0.65 0.23 25)', phone: '(555) 123-4567', phoneFill: '#ef4444', thinkingLine: 'Drafting outbound SMS to customer.', codeLine: 'tools/call → sms.send' },
      { x: 410, label: 'GOVERNED', pillStroke: 'oklch(0.65 0.18 150)', phone: '[redacted:phone]', phoneFill: '#22c55e', thinkingLine: 'PII redacted before reaching agent.', codeLine: 'policy: pii_redaction → enforce' },
    ].map((pane) => (
      <g key={pane.label} transform={`translate(${pane.x} 20)`}>
        <rect width="370" height="460" rx="12" fill="oklch(0.205 0 0)" stroke="oklch(1 0 0 / 0.1)" />
        <rect width="370" height="40" rx="12" fill="oklch(0.17 0 0)" />
        <text x="16" y="25" fill="oklch(0.985 0 0)" fontSize="12" fontWeight="600" fontFamily="var(--font-sans)">Slack · Alex from Acme</text>
        <rect x="20" y="60" width="110" height="22" rx="11" fill="none" stroke={pane.pillStroke} strokeWidth="1" />
        <text x="75" y="75" textAnchor="middle" fill={pane.pillStroke} fontSize="10" fontWeight="600" letterSpacing="1" fontFamily="var(--font-sans)">{pane.label}</text>
        <g transform="translate(20 110)" fontFamily="var(--font-sans)">
          <circle cx="14" cy="14" r="14" fill="oklch(0.35 0 0)" />
          <text x="14" y="18" textAnchor="middle" fill="oklch(0.985 0 0)" fontSize="11" fontWeight="600">A</text>
          <text x="40" y="10" fill="oklch(0.7 0 0)" fontSize="11">Alex from Acme · just now</text>
          <text x="40" y="32" fill="oklch(0.985 0 0)" fontSize="13">Can you reach out to Sam</text>
          <text x="40" y="52" fill="oklch(0.985 0 0)" fontSize="13">about renewal? Best number is</text>
          <text x="40" y="72" fill={pane.phoneFill} fontSize="13" fontWeight="600">{pane.phone}</text>
        </g>
        <rect x="20" y="220" width="330" height="190" rx="8" fill="oklch(0.17 0 0)" stroke="oklch(1 0 0 / 0.06)" />
        <text x="34" y="246" fill="oklch(0.7 0 0)" fontSize="10" fontWeight="600" letterSpacing="1" fontFamily="var(--font-sans)">AGENT THINKING · OPUS 4.7</text>
        <text x="34" y="274" fill="oklch(0.985 0 0 / 0.8)" fontSize="12" fontFamily="var(--font-sans)">Customer phone number detected.</text>
        <text x="34" y="296" fill="oklch(0.985 0 0 / 0.8)" fontSize="12" fontFamily="var(--font-sans)">{pane.thinkingLine}</text>
        <text x="34" y="340" fill={pane.phoneFill} fontSize="11" fontFamily="var(--font-mono)">{pane.codeLine}</text>
        <text x="34" y="370" fill="oklch(0.7 0 0 / 0.5)" fontSize="10" fontFamily="var(--font-mono)">extended thinking · 2048 tokens</text>
      </g>
    ))}
  </svg>
);

export const Hero = () => (
  <section className="relative overflow-hidden">
    <div
      className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-3xl pointer-events-none"
      style={{ background: 'radial-gradient(circle, oklch(0.62 0.22 267 / 0.14), transparent 70%)' }}
      aria-hidden
    />
    <div
      className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full blur-3xl pointer-events-none"
      style={{ background: 'radial-gradient(circle, oklch(0.5 0.22 25 / 0.08), transparent 70%)' }}
      aria-hidden
    />

    <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-20 md:pt-24 md:pb-24">
      <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <p className="text-xs md:text-sm font-semibold uppercase tracking-widest text-[var(--brand)]">
            Semantic GPS · Governance for agentic workflows
          </p>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
            Stop your agent leaking into production.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            A gateway that sits between the agent and real tools, redacting data, blocking calls,
            and rolling back broken workflows.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              asChild
              className="h-12 px-6 text-base font-semibold rounded-md gap-2 bg-[var(--brand)] text-white shadow-[0_8px_24px_-8px_var(--brand)] hover:shadow-[0_12px_32px_-8px_var(--brand)] hover:bg-[var(--brand)]/90 transition-all duration-150 focus-visible:ring-[3px] focus-visible:ring-[var(--brand)]/50"
            >
              <Link href="#demo-video">
                <PlayIcon className="size-4" />
                Watch the 3-minute demo
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base gap-2">
              <Link href="/signup">
                Try the Playground
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>

          <Link
            href="https://github.com/mboss37/semantic-gps-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <GithubMark className="size-3.5" />
            View on GitHub
          </Link>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
              <SparklesIcon className="size-3" />
              Built with Claude Opus 4.7
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
              <ShieldCheckIcon className="size-3" />
              Open source, MIT
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
              <ActivityIcon className="size-3" />
              327 tests green
            </Badge>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div
            className="relative rounded-xl border border-border bg-card overflow-hidden aspect-[16/10]"
            style={{ boxShadow: '0 0 60px -15px oklch(0.62 0.22 267 / 0.35)' }}
          >
            {HERO_VIDEO_URL ? (
              <video
                src={HERO_VIDEO_URL}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="w-full h-full object-cover"
                aria-label="Playground A/B loop. Raw pane shows a customer phone number in a Slack message; governed pane shows the same message with the phone redacted."
              />
            ) : (
              <HeroABMock />
            )}
          </div>
        </div>
      </div>
    </div>
  </section>
);
