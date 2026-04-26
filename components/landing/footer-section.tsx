import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';

import { GithubMark } from './github-mark';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'TRel', href: '#architecture' },
      { label: 'Playground', href: '#features' },
      { label: 'Governance', href: '#governance' },
    ],
  },
  {
    title: 'Use it',
    links: [
      { label: 'Get started', href: '/signup' },
      { label: 'Sign in', href: '/login' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'README', href: 'https://github.com/mboss37/semantic-gps-hackathon#readme' },
      { label: 'GitHub', href: 'https://github.com/mboss37/semantic-gps-hackathon' },
    ],
  },
] as const;

export const FooterSection = () => (
  <footer className="relative border-t border-white/10 bg-black/20">
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-5 lg:gap-6">
        <div className="col-span-2">
          <Link href="/" className="mb-4 inline-flex items-center gap-2">
            <BrandMark className="size-5" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
              Semantic GPS
            </span>
          </Link>

          <p className="mb-6 max-w-xs text-[13px] leading-relaxed text-white/48">
            Gateway infrastructure for customer-owned MCP stacks. TRel extends MCP with Tool
            Relationships so agents can discover flows, fallback paths, and rollback scenarios.
          </p>

          <a
            href="https://github.com/mboss37/semantic-gps-hackathon"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[13px] text-white/52 transition-colors hover:text-white"
          >
            <GithubMark className="h-4 w-4" />
            View on GitHub
          </a>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="mb-4 text-[12px] font-medium tracking-[-0.01em] text-white">
              {column.title}
            </h3>
            <ul className="space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-white/48 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-5 text-[12px] text-white/38 md:flex-row">
        <p>© 2026 Semantic GPS. Built with Claude Opus 4.7.</p>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-blue-300" />
            Gateway operational
          </span>
        </div>
      </div>
    </div>
  </footer>
);
