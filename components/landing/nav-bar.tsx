import Link from 'next/link';
import { NetworkIcon, TerminalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GITHUB_URL = 'https://github.com/mboss37/semantic-gps-hackathon';

export const NavBar = () => (
  <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
    <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <NetworkIcon className="size-5 text-[var(--brand)]" />
        Semantic GPS
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          GitHub
        </Link>
        <Button asChild size="sm" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90"
        >
          <Link href="/signup">
            <TerminalIcon className="size-3.5" />
            Try the Playground
          </Link>
        </Button>
      </div>
    </div>
  </nav>
);
