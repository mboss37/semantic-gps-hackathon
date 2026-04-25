'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, BookOpenIcon, RouteIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GithubMark } from './github-mark';

const SIGNALS = [
  { label: 'policy mode', value: 'shadow -> enforce' },
  { label: 'workflow check', value: 'validated before call' },
  { label: 'failure path', value: 'audit + rollback' },
] as const;

const AGENT_CLIENTS = ['Claude', 'Cursor', 'Custom agent'] as const;
const DATA_ACCESS = ['Raw MCPs', 'OpenAPI services', 'Internal systems'] as const;

const GatewayHeroVisual = () => (
  <div className="relative min-h-[520px] overflow-hidden rounded-t-xl border border-b-0 border-border bg-background shadow-[0_-20px_80px_-20px_rgba(0,112,243,0.25),0_40px_80px_-20px_rgba(0,0,0,0.8)]">
    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-foreground/25 to-transparent z-10" />
    <div className="absolute inset-0 grid-lines-bg opacity-[0.08]" aria-hidden />
    <div
      className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full blur-[110px] opacity-45"
      style={{ background: 'radial-gradient(circle, var(--brand), transparent 62%)' }}
      aria-hidden
    />

    <div className="relative z-10 grid min-h-[520px] grid-cols-1 gap-5 p-6 md:p-8 lg:p-10 xl:grid-cols-[0.95fr_1.15fr_0.95fr]">
      <div className="flex flex-col justify-center gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/40">
            01 Agentic layer
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground/45">
            Claude, Cursor, and custom agents stay generic. No brittle business rules hardcoded in
            prompts or agent code.
          </p>
        </div>
        {AGENT_CLIENTS.map((agent) => (
          <div
            key={agent}
            className="rounded-xl border border-border bg-card/35 p-4 text-sm text-foreground/75 backdrop-blur-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2 rounded-full bg-(--brand)" />
              <span className="font-medium text-foreground">{agent}</span>
            </div>
            <p className="text-xs leading-relaxed text-foreground/45">Calls one governed endpoint.</p>
          </div>
        ))}
      </div>

      <div className="relative flex items-center justify-center">
        <div className="absolute left-0 right-0 top-1/2 hidden h-px bg-linear-to-r from-foreground/10 via-(--brand)/80 to-foreground/10 xl:block" />
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-linear-to-b from-transparent via-(--brand)/35 to-transparent xl:block" />
        <div className="relative w-full max-w-md rounded-3xl border border-(--brand)/55 bg-background/90 p-5 shadow-[0_0_90px_rgba(0,112,243,0.24)] backdrop-blur">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                02 Semantic GPS
              </p>
              <h3 className="mt-1 text-xl font-medium tracking-[-0.02em] text-foreground">
                Gateway boundary
              </h3>
            </div>
            <span className="rounded-full border border-(--brand)/35 bg-(--brand)/10 px-2.5 py-1 font-mono text-[10px] text-(--brand)">
              live rules
            </span>
          </div>

          <div className="grid gap-3">
            {SIGNALS.map((signal) => (
              <div
                key={signal.label}
                className="flex items-center justify-between rounded-lg border border-border bg-card/35 px-3 py-2.5"
              >
                <span className="text-xs text-foreground/50">{signal.label}</span>
                <span className="font-mono text-[11px] text-foreground/80">{signal.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {['policy', 'sandbox', 'audit'].map((label) => (
              <div
                key={label}
                className="rounded-md border border-border bg-background px-2 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/45"
              >
                {label}
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-xs leading-relaxed text-foreground/45">
            Business rules change here, instantly. Agents and MCPs do not redeploy.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/40">
            03 Data access layer
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground/45">
            Existing raw MCPs keep access to customer systems. Semantic GPS governs the call before
            it reaches them.
          </p>
        </div>
        {DATA_ACCESS.map((target, index) => (
          <div
            key={target}
            className="rounded-xl border border-border bg-card/35 p-4 text-sm text-foreground/75 backdrop-blur-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-foreground">{target}</span>
              <span className="font-mono text-[10px] text-foreground/35">0{index + 1}</span>
            </div>
            <p className="text-xs leading-relaxed text-foreground/45">
              Stays behind your auth, network, and data boundary.
            </p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const HeroSection = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 20);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <section className="relative overflow-hidden pt-14">
      {/* Atmosphere — gradient mesh + grid + noise */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 grid-lines-bg opacity-[0.15]" />
        <div
          className="absolute -top-40 -right-20 w-[1100px] h-[1100px] rounded-full blur-[160px] opacity-45"
          style={{
            background: 'radial-gradient(circle, var(--brand) 0%, transparent 55%)',
          }}
        />
        <div
          className="absolute top-[20%] -left-40 w-[720px] h-[720px] rounded-full blur-[140px] opacity-25"
          style={{
            background:
              'radial-gradient(circle, oklch(0.6 0.22 254) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-[40%] h-px bg-linear-to-r from-transparent via-(--brand)/40 to-transparent opacity-60"
        />
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* TOP — headline + subhead + CTAs */}
        <div className="pt-20 lg:pt-28 pb-14 lg:pb-20">
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur-sm px-3 py-1 mb-8 transition-all duration-500 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[oklch(0.72_0.18_150)] opacity-60 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_150)]" />
            </span>
            <span className="text-[11px] font-medium text-foreground/75 tracking-[0.02em]">
              Bring your own MCPs
            </span>
            <span className="w-px h-3 bg-border" />
            <span className="text-[11px] font-mono text-foreground/50">
              policies · sandbox · audit
            </span>
          </div>

          <div className="max-w-6xl">
            <h1
              className={`font-medium leading-[1.02] lg:leading-[0.98] tracking-[-0.035em] text-foreground transition-all duration-700 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.75rem)' }}
            >
              Govern any MCP
              <br />
              <span className="text-foreground/55">before agents touch production.</span>
            </h1>

            <div
              className={`mt-7 max-w-3xl transition-all duration-700 delay-150 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-[15px] md:text-lg text-foreground/65 leading-[1.6]">
                Semantic GPS sits between your agents and the MCP servers you already run. Sandbox
                workflows, enforce policy, validate tool paths, audit every call, and roll back
                broken actions without rewriting a single MCP.
              </p>
            </div>
          </div>

          <div
            className={`flex flex-wrap items-center gap-3 mt-12 transition-all duration-700 delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <Button
              asChild
              size="lg"
              className="h-11 px-5 rounded-md bg-foreground text-background hover:bg-foreground/90 text-[14px] font-medium"
            >
              <Link href="/signup">
                Start sandboxing MCPs
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 px-5 rounded-md border-foreground/15 bg-background/40 backdrop-blur-sm hover:bg-foreground/5 text-[14px] font-medium text-foreground"
            >
              <Link href="#how-it-works">
                <RouteIcon className="w-3.5 h-3.5 mr-1.5" />
                See how it works
              </Link>
            </Button>

            <span className="hidden md:block w-px h-6 bg-border mx-2" />

            <a
              href="https://github.com/mboss37/semantic-gps-hackathon#readme"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-11 px-3 text-[13px] text-foreground/70 hover:text-foreground transition-colors"
            >
              <BookOpenIcon className="w-3.5 h-3.5" />
              View the docs
            </a>
            <a
              href="https://github.com/mboss37/semantic-gps-hackathon"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-11 px-3 text-[13px] text-foreground/70 hover:text-foreground transition-colors"
            >
              <GithubMark className="w-3.5 h-3.5" />
              Open source
            </a>
          </div>
        </div>

        {/* Gateway visual — vendor-neutral, so the hero reads as infrastructure. */}
        <div
          className={`relative pb-10 transition-all duration-1000 delay-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Backlight under the dashboard */}
          <div
            className="absolute -top-8 left-1/2 -translate-x-1/2 w-[70%] h-20 rounded-full blur-3xl opacity-70 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--brand) 50%, transparent)',
            }}
            aria-hidden
          />

          <GatewayHeroVisual />
        </div>
      </div>
    </section>
  );
};
