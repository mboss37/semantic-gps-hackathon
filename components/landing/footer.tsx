import Link from 'next/link';
import { NetworkIcon, SparklesIcon, TrophyIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GithubMark } from '@/components/landing/github-mark';
import { TechStrip } from '@/components/landing/tech-strip';

const GITHUB_URL = 'https://github.com/mboss37/semantic-gps-hackathon';

const outboundLink = 'text-sm text-muted-foreground hover:text-foreground transition-colors';

export const Footer = () => (
  <footer className="border-t border-border bg-muted/30 py-16">
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      <TechStrip />
      <div className="grid md:grid-cols-4 gap-8 py-12 border-t border-border/50">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <NetworkIcon className="size-5 text-[var(--brand)]" />
            Semantic GPS
          </div>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            A control plane for MCP agents, with live policies and typed saga rollback.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Product</h3>
          <Link href="/signup" className={outboundLink}>Playground</Link>
          <Link href="/dashboard" className={outboundLink}>Dashboard</Link>
          <Link href="/dashboard/policies/catalog" className={outboundLink}>Policy Catalog</Link>
          <Link href="/dashboard/graph" className={outboundLink}>Workflow Graph</Link>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Developers</h3>
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={outboundLink}>
            GitHub
          </Link>
          <Link
            href={`${GITHUB_URL}/blob/main/VISION.md`}
            target="_blank"
            rel="noopener noreferrer"
            className={outboundLink}
          >
            VISION.md
          </Link>
          <Link
            href={`${GITHUB_URL}/blob/main/docs/ARCHITECTURE.md`}
            target="_blank"
            rel="noopener noreferrer"
            className={outboundLink}
          >
            Architecture docs
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Submitted to</h3>
          <div className="rounded-md border border-border p-4 bg-card flex flex-col gap-2">
            <Badge variant="outline" className="w-fit gap-1.5 text-xs">
              <TrophyIcon className="size-3" />
              Hackathon
            </Badge>
            <p className="text-sm font-medium">Cerebral Valley × Anthropic 2026</p>
            <p className="text-xs text-muted-foreground">Submitted Apr 26, 2026</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-8 border-t border-border/50 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <GithubMark className="size-3.5" />
            Star on GitHub
          </Link>
          <span>·</span>
          <span>MIT License</span>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <SparklesIcon className="size-3 text-[var(--brand)]" />
          Built with Claude Opus 4.7
        </Badge>
      </div>
    </div>
  </footer>
);
