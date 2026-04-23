import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';

import { VerifiedHandler } from './verified-handler';

const Home = () => (
  <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-24">
    <Suspense fallback={null}>
      <VerifiedHandler />
    </Suspense>
    <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
      <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
        Semantic GPS
      </h1>
      <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
        The control plane for MCP agents: live policy enforcement, typed workflow
        discovery, and audit — all through one gateway.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/dashboard">Open Dashboard</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a
            href="https://github.com/mboss37/semantic-gps-hackathon"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </Button>
      </div>
    </div>
  </main>
);

export default Home;
