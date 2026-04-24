'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GithubMark } from './github-mark';

export const CtaSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="demo" ref={sectionRef} className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div
          className={`max-w-3xl transition-all duration-500 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <h2 className="text-[32px] md:text-[40px] lg:text-[52px] font-medium leading-[1.08] tracking-[-0.02em] text-foreground mb-6">
            Run the same agent with and without the gateway.
          </h2>
          <p className="text-lg text-foreground/60 leading-relaxed mb-10 max-w-xl">
            One prompt, two panes, one governance decision. Watch a leak, flip a column, watch it
            stop. Opus 4.7 with extended thinking on both sides — the only variable is the gateway.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-3">
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
              className="h-11 px-5 rounded-md border-foreground/15 bg-transparent hover:bg-foreground/5 text-[14px] font-medium text-foreground"
            >
              <Link href="#demo-video">Watch the demo</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-11 px-4 rounded-md text-[14px] font-medium text-foreground/65 hover:text-foreground hover:bg-transparent"
            >
              <a
                href="https://github.com/mboss37/semantic-gps-hackathon"
                target="_blank"
                rel="noreferrer"
              >
                <GithubMark className="w-4 h-4 mr-2" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
