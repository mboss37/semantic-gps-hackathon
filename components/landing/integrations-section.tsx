'use client';

import { useEffect, useRef, useState } from 'react';

type Integration = {
  name: string;
  kind: string;
  status: 'mcp' | 'openapi';
  initial: string;
};

const INTEGRATIONS: readonly Integration[] = [
  { name: 'Internal MCPs', kind: 'Customer-hosted tools behind your firewall', status: 'mcp', initial: 'IN' },
  { name: 'Vendor MCPs', kind: 'Any compliant HTTP-Streamable server', status: 'mcp', initial: 'VD' },
  { name: 'OpenAPI services', kind: 'Import specs and expose them as MCP tools', status: 'openapi', initial: 'OA' },
  { name: 'Custom tools', kind: 'Register bespoke operations from the dashboard', status: 'mcp', initial: '+' },
  { name: 'Local or VPC apps', kind: 'Govern tools without moving data to a SaaS proxy', status: 'mcp', initial: 'VP' },
  { name: 'Sandbox endpoints', kind: 'Validate routes before promoting to production', status: 'openapi', initial: 'SB' },
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
            MCP-independent
          </p>
          <h2 className="text-[32px] md:text-[40px] lg:text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground mb-4">
            Bring your own MCP stack.
          </h2>
          <p className="text-lg text-foreground/60 leading-relaxed">
            Semantic GPS is not a vendor-specific integration bundle. It is the governance layer in
            front of whatever MCP servers your company already trusts.
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
                {integration.status === 'mcp' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/60 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-(--brand)" />
                    MCP
                  </span>
                ) : (
                  <span className="text-[11px] text-foreground/40 font-mono">OpenAPI</span>
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
