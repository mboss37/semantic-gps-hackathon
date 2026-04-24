'use client';

import { useEffect, useRef, useState } from 'react';

type Integration = {
  name: string;
  kind: string;
  status: 'live' | 'bring-your-own';
  initial: string;
};

const INTEGRATIONS: readonly Integration[] = [
  { name: 'Salesforce', kind: 'CRM · 5 tools registered', status: 'live', initial: 'SF' },
  { name: 'Slack', kind: 'Messaging · 4 tools registered', status: 'live', initial: 'SL' },
  { name: 'GitHub', kind: 'Code · 4 tools registered', status: 'live', initial: 'GH' },
  { name: 'OpenAPI', kind: 'Import any spec · auto-discover', status: 'bring-your-own', initial: 'OA' },
  { name: 'HTTP-Streamable MCP', kind: 'Any compliant server', status: 'bring-your-own', initial: 'MC' },
  { name: 'Custom', kind: 'Register via dashboard', status: 'bring-your-own', initial: '+' },
];

export const IntegrationsSection = () => {
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
    <section
      id="integrations"
      ref={sectionRef}
      className="relative py-20 lg:py-28 border-t border-border bg-card/20"
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div
          className={`max-w-2xl mb-14 transition-all duration-500 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <p className="text-[12px] text-foreground/50 uppercase tracking-[0.14em] font-medium mb-4">
            Integrations
          </p>
          <h2 className="text-[32px] md:text-[40px] lg:text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground mb-4">
            Bring your own MCPs. Three already live.
          </h2>
          <p className="text-lg text-foreground/60 leading-relaxed">
            Register any HTTP-Streamable MCP or OpenAPI service. Tools discover automatically,
            relationships wire the graph, every call lands in the audit log.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {INTEGRATIONS.map((integration, i) => (
            <div
              key={integration.name}
              className={`bg-background p-6 transition-all duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-md bg-card border border-border flex items-center justify-center">
                  <span className="text-[11px] font-mono font-medium text-foreground/70 tracking-wider">
                    {integration.initial}
                  </span>
                </div>
                {integration.status === 'live' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/60 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                    Live
                  </span>
                ) : (
                  <span className="text-[11px] text-foreground/40 font-mono">Connect</span>
                )}
              </div>
              <div className="text-[15px] font-medium text-foreground mb-1 tracking-[-0.01em]">
                {integration.name}
              </div>
              <div className="text-[13px] text-foreground/55 leading-relaxed">
                {integration.kind}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
