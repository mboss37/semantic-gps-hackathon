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
    <section id="architecture" ref={sectionRef} className="relative py-20 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid gap-12">
          <div
            className={`max-w-4xl transition-all duration-500 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <p className="text-[12px] text-foreground/50 uppercase tracking-[0.14em] font-medium mb-4">
              Architecture
            </p>
            <h2 className="text-[38px] md:text-[52px] font-medium leading-[1.05] tracking-[-0.03em] text-foreground mb-5">
              A gateway layer for any MCP stack.
            </h2>
            <p className="text-base md:text-lg text-foreground/60 leading-relaxed mb-10 max-w-2xl">
              The gateway sits between agent loops and customer-owned tool servers. Policies,
              route validation, audit, and rollback happen before the call crosses into production.
              Look for the reverse walk of{' '}
              <code className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-card border border-border text-foreground">
                compensated_by
              </code>{' '}
              edges when a route halts mid-way.
            </p>

            <div className="grid max-w-2xl grid-cols-3 gap-x-6 gap-y-2 pt-6 border-t border-border">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <div className="text-4xl font-medium tracking-tight text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-[12px] text-foreground/55 leading-tight">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`transition-all duration-500 delay-100 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <div className="relative overflow-hidden rounded-xl border border-border bg-background">
              <div className="relative z-10 flex items-center justify-between border-b border-border bg-card/30 px-4 py-3 backdrop-blur-sm">
                <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/45">
                  governed route boundary
                </span>
                <span className="rounded-full border border-(--brand)/25 bg-(--brand)/10 px-2 py-0.5 font-mono text-[10px] text-(--brand)">
                  MCP in · policy out
                </span>
              </div>
              <div className="relative z-10 p-6 md:p-8">
                <ArchitectureDiagram />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
