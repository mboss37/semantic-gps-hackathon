import Link from 'next/link';

import { GithubMark } from './github-mark';

const BrandMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--brand)" />
    <circle cx="12" cy="12" r="3" fill="#ffffff" />
  </svg>
);

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Architecture', href: '#architecture' },
      { label: 'Governance', href: '#governance' },
    ],
  },
  {
    title: 'Use it',
    links: [
      { label: 'Get started', href: '/signup' },
      { label: 'Sign in', href: '/login' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Audit log', href: '/dashboard/audit' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'README', href: 'https://github.com/mboss37/semantic-gps-hackathon#readme' },
      {
        label: 'Architecture',
        href: 'https://github.com/mboss37/semantic-gps-hackathon/blob/main/docs/ARCHITECTURE.md',
      },
      { label: 'Vision', href: 'https://github.com/mboss37/semantic-gps-hackathon/blob/main/VISION.md' },
      { label: 'Demo script', href: 'https://github.com/mboss37/semantic-gps-hackathon/blob/main/docs/DEMO.md' },
    ],
  },
] as const;

export const FooterSection = () => (
  <footer className="relative border-t border-border">
    <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
      <div className="py-14 grid grid-cols-2 md:grid-cols-5 gap-10 lg:gap-6">
        <div className="col-span-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <BrandMark className="w-5 h-5" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              Semantic GPS
            </span>
          </Link>

          <p className="text-[13px] text-foreground/55 leading-relaxed mb-6 max-w-xs">
            The control plane for MCP agents. Govern every call, observe every decision, roll back
            when a route halts.
          </p>

          <a
            href="https://github.com/mboss37/semantic-gps-hackathon"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[13px] text-foreground/60 hover:text-foreground transition-colors"
          >
            <GithubMark className="w-4 h-4" />
            View on GitHub
          </a>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-[12px] font-medium text-foreground mb-4 tracking-[-0.01em]">
              {column.title}
            </h3>
            <ul className="space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-foreground/55 hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="py-5 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-foreground/45">
        <p>© 2026 Semantic GPS. Built with Claude Opus 4.7.</p>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
            Gateway operational
          </span>
        </div>
      </div>
    </div>
  </footer>
);
