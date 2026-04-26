import Link from 'next/link';
import { ArrowRightIcon, SparklesIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GithubMark } from './github-mark';

export const CtaSection = () => (
  <section id="final-cta" className="relative overflow-hidden py-24 lg:py-32">
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/45 p-6 shadow-[0_40px_140px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:p-10 lg:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.1),transparent_32%)]" />
        <div className="grid-lines-bg absolute inset-0 opacity-[0.06]" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-blue-100/62 uppercase">
              Ready for validation
            </p>
            <h2 className="max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.055em] text-balance text-white md:text-6xl">
              Put Semantic GPS between agents and business systems.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/58">
              Shadow &rarr; enforce live policy swap. Audit on every call. Saga rollback. The
              governance layer the recent Replit, Meta, and Cursor incidents would have needed.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90"
            >
              <Link href="/signup">
                Start free
                <ArrowRightIcon className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/14 bg-white/4.5 px-6 text-sm font-semibold text-white backdrop-blur-xl hover:bg-white/8 hover:text-white"
            >
              <Link href="#incidents">
                <SparklesIcon className="mr-2 size-4" />
                See the receipts
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-5 text-sm font-semibold text-white/62 hover:bg-white/6 hover:text-white"
            >
              <a
                href="https://github.com/mboss37/semantic-gps-hackathon"
                target="_blank"
                rel="noreferrer"
              >
                <GithubMark className="mr-2 size-4" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);
