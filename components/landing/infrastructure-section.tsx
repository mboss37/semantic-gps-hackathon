'use client';

import { useEffect, useRef, useState } from 'react';

import { ArchitectureDiagram } from './architecture-diagram';

const STATS = [
  { value: '12', label: 'Built-in policies' },
  { value: '8', label: 'Relationship types' },
  { value: '13', label: 'Tenant tables with RLS' },
] as const;

export const InfrastructureSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="architecture" ref={sectionRef} className="relative py-20 lg:py-28">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <div
            className={`lg:col-span-5 lg:sticky lg:top-24 transition-all duration-500 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <p className="text-[12px] text-foreground/50 uppercase tracking-[0.14em] font-medium mb-4">
              Architecture
            </p>
            <h2 className="text-[32px] md:text-[40px] lg:text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground mb-5">
              A control plane for any MCP agent.
            </h2>
            <p className="text-base text-foreground/60 leading-relaxed mb-10 max-w-md">
              The gateway sits between the agent loop and the real tools. Look for the manifest
              cache, the policy engine gate at every call, and the reverse walk of{' '}
              <code className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-card border border-border text-foreground">
                compensated_by
              </code>{' '}
              edges when a route halts mid-way.
            </p>

            <div className="grid grid-cols-3 gap-x-4 gap-y-2 pt-6 border-t border-border">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl font-medium tracking-[-0.02em] text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-[12px] text-foreground/55 leading-tight">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`lg:col-span-7 transition-all duration-500 delay-100 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <div className="rounded-lg border border-border bg-card/30 p-6 md:p-8">
              <ArchitectureDiagram />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
