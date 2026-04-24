'use client';

import { useEffect, useRef, useState } from 'react';

type Step = {
  number: string;
  title: string;
  description: string;
  code: string;
  filename: string;
};

const STEPS: readonly Step[] = [
  {
    number: '01',
    title: 'Register your MCPs',
    description:
      'Point the gateway at any HTTP-Streamable MCP or OpenAPI service. Tool schemas import automatically. Typed relationships wire the graph.',
    filename: 'register.http',
    code: `POST /api/servers
{
  "name": "salesforce",
  "transport": "http-streamable",
  "origin_url": "https://sf.example.com/mcp",
  "auth_config": { "kind": "oauth2" }
}

// -> 14 tools discovered, 12 edges inferred`,
  },
  {
    number: '02',
    title: 'Apply policies',
    description:
      'Pick from twelve built-in runners across seven governance dimensions. Shadow-observe first. Flip a column to enforce when the audit is clean.',
    filename: 'policy.json',
    code: `{
  "builtin_key": "pii_redaction",
  "mode": "shadow",
  "target_tool": "get_contact",
  "config": {
    "patterns": ["phone", "email"]
  }
}

// -> next call obeys, no restart`,
  },
  {
    number: '03',
    title: 'Run governed workflows',
    description:
      'Agents point at one org URL, one per-domain URL, or one per-server URL. Every call lands in the audit log with trace ID, policy decisions, and latency.',
    filename: 'execute.jsonrpc',
    code: `{
  "method": "execute_route",
  "params": {
    "route": "sales_escalation",
    "inputs": { "account_name": "Edge" }
  }
}

// -> 5 steps, saga-honest on halt`,
  },
];

export const HowItWorksSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);

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

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % STEPS.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-20 lg:py-28 border-t border-border bg-card/20"
    >
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-8">
        <div
          className={`max-w-2xl mb-16 transition-all duration-500 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <p className="text-[12px] text-foreground/50 uppercase tracking-[0.14em] font-medium mb-4">
            How it works
          </p>
          <h2 className="text-[32px] md:text-[40px] lg:text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground mb-4">
            From raw MCPs to governed workflows in three steps.
          </h2>
          <p className="text-lg text-foreground/60 leading-relaxed">
            Register your servers, apply gateway-native policies, and route agents through a single
            auditable entry point.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10 lg:gap-16">
          <div className="lg:col-span-2 space-y-0">
            {STEPS.map((step, i) => {
              const isActive = active === i;
              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`w-full text-left py-6 border-t border-border last:border-b transition-opacity duration-300 ${
                    isActive ? 'opacity-100' : 'opacity-55 hover:opacity-85'
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <span className="text-[11px] font-mono text-foreground/40 tracking-[0.1em] pt-1 shrink-0">
                      {step.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-foreground mb-1.5 tracking-[-0.01em]">
                        {step.title}
                      </h3>
                      <p className="text-sm text-foreground/60 leading-relaxed">
                        {step.description}
                      </p>
                      {isActive && (
                        <div className="mt-4 h-px bg-border overflow-hidden">
                          <div
                            className="h-full bg-foreground/50"
                            style={{ animation: 'progress 5.2s linear forwards' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 lg:sticky lg:top-24 self-start">
            <div className="border border-border bg-background overflow-hidden rounded-lg">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
                </div>
                <span className="text-[11px] font-mono text-foreground/50">
                  {STEPS[active].filename}
                </span>
              </div>
              <div className="p-6 font-mono text-[13px] min-h-[320px] leading-[1.7]">
                <pre className="text-foreground/80 whitespace-pre-wrap">
                  {STEPS[active].code.split('\n').map((line, i) => (
                    <div key={`${active}-${i}`} className="flex gap-4">
                      <span className="text-foreground/30 select-none w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <span>{line || ' '}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
};
