'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldIcon, LockIcon, EyeIcon, FileCheckIcon } from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldIcon,
    title: 'Twelve gateway-native policies',
    description:
      'Hygiene, identity, rate, time, residency, kill-switch, idempotency. Group in a catalog, apply in one click.',
  },
  {
    icon: LockIcon,
    title: 'Row-level security on thirteen tables',
    description:
      'Postgres RLS plus JWT claim hook. Cross-org UUID guess returns empty at the DB layer, not the app.',
  },
  {
    icon: EyeIcon,
    title: 'Shadow observes, enforce blocks',
    description:
      'Flip any policy from shadow to enforce with a single column change. No restart, no redeploy.',
  },
  {
    icon: FileCheckIcon,
    title: 'Seven-day decision timeline',
    description:
      'Allow, shadow-block, enforce-block counts per policy, rendered as stacked bars on the policy detail page.',
  },
] as const;

const DIMENSIONS = ['Hygiene', 'Identity', 'Rate', 'Time', 'Residency', 'Kill-switch', 'Idempotency'] as const;

export const SecuritySection = () => {
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
    <section id="governance" ref={sectionRef} className="relative py-20 lg:py-28">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
          <div
            className={`lg:col-span-5 transition-all duration-500 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <p className="text-[12px] text-foreground/50 uppercase tracking-[0.14em] font-medium mb-4">
              Governance
            </p>
            <h2 className="text-[32px] md:text-[40px] lg:text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground mb-5">
              Twelve policies. Seven dimensions.
            </h2>
            <p className="text-base text-foreground/60 leading-relaxed mb-8 max-w-md">
              Shadow mode observes violations without blocking. Enforce mode blocks the call on the
              next request. Flip one column, the next call obeys.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {DIMENSIONS.map((dim) => (
                <span
                  key={dim}
                  className="px-2.5 py-1 rounded-md border border-border bg-card/40 text-[11px] font-mono text-foreground/60"
                >
                  {dim}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`bg-background p-6 transition-all duration-500 ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                  }`}
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  <div className="w-9 h-9 rounded-md border border-border flex items-center justify-center text-foreground/70 mb-4">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-[15px] font-medium text-foreground mb-1.5 tracking-[-0.01em]">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] text-foreground/55 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
