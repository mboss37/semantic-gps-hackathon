'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, BookOpenIcon, PlayIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GithubMark } from './github-mark';

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
          className="absolute inset-x-0 top-[40%] h-[1px] bg-gradient-to-r from-transparent via-[var(--brand)]/40 to-transparent opacity-60"
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
              Gateway operational
            </span>
            <span className="w-px h-3 bg-border" />
            <span className="text-[11px] font-mono text-foreground/50">v1.0 · MCP</span>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-14 items-end">
            <h1
              className={`lg:col-span-8 font-medium leading-[1.02] lg:leading-[0.98] tracking-[-0.035em] text-foreground transition-all duration-700 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.75rem)' }}
            >
              The control plane
              <br />
              <span className="text-foreground/55">for MCP agents.</span>
            </h1>

            <div
              className={`lg:col-span-4 transition-all duration-700 delay-150 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-[15px] md:text-base text-foreground/65 leading-[1.55]">
                A gateway between every agent and its tools. Govern every call with typed policies,
                observe in shadow mode, and roll back broken workflows with compensated routes —
                all from one auditable entry point.
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
                Get started
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 px-5 rounded-md border-foreground/15 bg-background/40 backdrop-blur-sm hover:bg-foreground/5 text-[14px] font-medium text-foreground"
            >
              <Link href="#demo">
                <PlayIcon className="w-3.5 h-3.5 mr-1.5" />
                Watch the 3-minute demo
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

        {/* DASHBOARD — full-width, cropped, backlit */}
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

          <div className="relative rounded-t-xl border border-b-0 border-border bg-background overflow-hidden shadow-[0_-20px_80px_-20px_rgba(0,112,243,0.25),0_40px_80px_-20px_rgba(0,0,0,0.8)]">
            {/* Faint top highlight — laptop screen backlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/25 to-transparent z-10" />
            {/* Sprint 21 WP-21.4: real dashboard screenshot. Captured via
                Playwright against seeded local data so the layout, polish,
                and policy counts are all real. Update via:
                  pnpm playground-screenshot  (or re-shoot manually). */}
            <Image
              src="/landing/dashboard-hero.png"
              alt="Semantic GPS dashboard — 3 MCP servers, 14 tools, 4 active policies"
              width={1200}
              height={1169}
              priority
              className="block w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
