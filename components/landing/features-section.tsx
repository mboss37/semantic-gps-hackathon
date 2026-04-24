'use client';

import { useEffect, useRef, useState } from 'react';

type Feature = {
  title: string;
  lede: string;
  bullets: readonly string[];
  visual: 'leak' | 'govern' | 'rollback' | 'audit';
};

const FEATURES: readonly Feature[] = [
  {
    title: 'Stop the leak',
    lede:
      "PII never enters the agent's context when the gateway is between them. Shadow-observe for a week, then flip a column and start blocking.",
    bullets: [
      'Scrub phone numbers, emails, and card patterns out of tool responses before the agent reads them.',
      'Block prompt-injection payloads at the gateway, not inside the upstream tool.',
      'Flip any policy from shadow to enforce with a single click. No restart, no redeploy.',
      'Review allow, shadow-block, and enforce-block counts per policy over the last seven days.',
    ],
    visual: 'leak',
  },
  {
    title: 'Govern the call, not the data',
    lede:
      'Twelve gateway-native policies decide who calls what, when, from where, and whether the arguments are safe. Agent frameworks keep the data rules.',
    bullets: [
      'Apply any of twelve built-in policies from a catalog grouped by governance dimension.',
      'Gate calls on time windows, rate limits, caller identity, or client IP. Per tool or per org.',
      'Require an agent-identity header so the gateway never runs for an unidentified caller.',
      'Compare raw MCP and governed gateway in a live A/B, with Opus 4.7 thinking on both panes.',
    ],
    visual: 'govern',
  },
  {
    title: 'Recover when agents fail',
    lede:
      'Typed relationships tell the gateway how tools connect. When a multi-step workflow halts mid-way, it walks the graph in reverse and undoes the completed steps.',
    bullets: [
      'Declare undo paths once as compensated_by edges. The gateway walks them in reverse on any halt.',
      'Map compensator arguments per step, so undo calls get correctly-shaped inputs.',
      'Fall back to an alternative tool chain on origin error, with a fallback_triggered audit event.',
      'Build on eight typed relationship types, including produces_input_for, validates, alternative_to.',
    ],
    visual: 'rollback',
  },
  {
    title: 'Prove it happened',
    lede:
      'Every call lands in the audit log with trace ID, policy decisions, and latency. Charts over the events table turn the log into a dashboard a compliance team can read.',
    bullets: [
      'Filter the audit log by scope, time, or trace to walk any single workflow end to end.',
      'Read call volume, policy blocks per rule, and PII detections per pattern on three live charts.',
      'Point agents at one org URL, one per-domain URL, or one per-server URL. Every scope honest.',
      'Rely on Postgres row-level security across thirteen tenant tables, not just app-layer filters.',
    ],
    visual: 'audit',
  },
];

const LeakVisual = () => (
  <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
    <rect x="24" y="32" width="160" height="156" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.15" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <g key={i}>
        <rect
          x="40"
          y={50 + i * 22}
          width="128"
          height="8"
          rx="2"
          fill="currentColor"
          fillOpacity="0.08"
        />
        {i === 2 && (
          <rect x="40" y={50 + i * 22} width="80" height="8" rx="2" fill="var(--brand)" fillOpacity="0.85">
            <animate attributeName="fillOpacity" values="0.5;0.95;0.5" dur="2.4s" repeatCount="indefinite" />
          </rect>
        )}
      </g>
    ))}
    <g stroke="var(--brand)" strokeOpacity="0.6" strokeWidth="1.2" fill="none" strokeDasharray="3 4">
      <line x1="184" y1="110" x2="228" y2="110">
        <animate attributeName="strokeDashoffset" values="0;-14" dur="1.2s" repeatCount="indefinite" />
      </line>
    </g>
    <rect x="228" y="84" width="60" height="52" rx="6" fill="var(--brand)" fillOpacity="0.08" stroke="var(--brand)" strokeOpacity="0.55" />
    <text x="258" y="114" textAnchor="middle" fill="var(--brand)" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="0.1em">
      GATE
    </text>
  </svg>
);

const GovernVisual = () => (
  <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
    {[0, 1, 2, 3].map((i) => {
      const y = 36 + i * 42;
      const pass = i === 0 || i === 2;
      return (
        <g key={i}>
          <line
            x1="16"
            y1={y + 12}
            x2="132"
            y2={y + 12}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeDasharray="3 4"
          />
          <circle cx="16" cy={y + 12} r="3" fill="currentColor" opacity="0.5" />
          <rect
            x="140"
            y={y}
            width="24"
            height="24"
            rx="4"
            fill="none"
            stroke={pass ? 'var(--brand)' : '#ef4444'}
            strokeOpacity="0.55"
          />
          <line
            x1="172"
            y1={y + 12}
            x2={pass ? 296 : 210}
            y2={y + 12}
            stroke={pass ? 'var(--brand)' : '#ef4444'}
            strokeOpacity="0.7"
            strokeDasharray={pass ? '' : '3 4'}
          />
          {pass ? (
            <polygon points={`296,${y + 8} 304,${y + 12} 296,${y + 16}`} fill="var(--brand)" fillOpacity="0.85" />
          ) : (
            <text x="216" y={y + 16} fill="#ef4444" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="0.05em">
              blocked
            </text>
          )}
        </g>
      );
    })}
  </svg>
);

const RollbackVisual = () => (
  <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
    {[0, 1, 2].map((i) => (
      <g key={i} transform={`translate(${40 + i * 84} 66)`}>
        <rect width="56" height="44" rx="6" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.2" />
        <text x="28" y="27" textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="11" fontFamily="var(--font-geist-mono)">
          step {i + 1}
        </text>
      </g>
    ))}
    <g stroke="#ef4444" strokeOpacity="0.65" strokeWidth="1.3" fill="none">
      <path d="M96 88 L124 88" />
      <path d="M180 88 L208 88" />
    </g>
    <g stroke="var(--brand)" strokeOpacity="0.75" strokeWidth="1.4" fill="none">
      <path d="M224 140 Q160 180 96 140" strokeDasharray="3 4">
        <animate attributeName="strokeDashoffset" values="0;-14" dur="1.4s" repeatCount="indefinite" />
      </path>
      <polygon points="96,140 106,134 106,146" fill="var(--brand)" fillOpacity="0.85" />
    </g>
    <text x="160" y="200" textAnchor="middle" fill="var(--brand)" opacity="0.75" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="0.05em">
      compensated_by
    </text>
  </svg>
);

const AuditVisual = () => (
  <svg viewBox="0 0 320 220" className="w-full h-full" aria-hidden>
    <rect x="24" y="28" width="272" height="164" rx="6" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.12" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <g key={i}>
        <rect x="40" y={44 + i * 22} width="104" height="6" rx="2" fill="currentColor" fillOpacity={0.14 - i * 0.012} />
        <rect
          x="156"
          y={44 + i * 22}
          width={60 - i * 5}
          height="6"
          rx="2"
          fill="var(--brand)"
          fillOpacity="0.6"
        >
          <animate
            attributeName="width"
            values={`0;${60 - i * 5};${60 - i * 5}`}
            keyTimes="0;0.7;1"
            dur="2s"
            begin={`${i * 0.12}s`}
            repeatCount="indefinite"
          />
        </rect>
      </g>
    ))}
  </svg>
);

const Visual = ({ type }: { type: Feature['visual'] }) => {
  if (type === 'leak') return <LeakVisual />;
  if (type === 'govern') return <GovernVisual />;
  if (type === 'rollback') return <RollbackVisual />;
  return <AuditVisual />;
};

const FeatureRow = ({ feature, index }: { feature: Feature; index: number }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const reverse = index % 2 === 1;

  return (
    <div
      ref={rowRef}
      className={`transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <div
        className={`grid lg:grid-cols-2 gap-10 lg:gap-20 py-16 lg:py-24 border-t border-border ${
          reverse ? 'lg:[&>*:first-child]:order-2' : ''
        }`}
      >
        <div className="flex flex-col justify-center">
          <h3 className="text-2xl md:text-3xl font-medium tracking-[-0.02em] text-foreground mb-4">
            {feature.title}
          </h3>
          <p className="text-[15px] md:text-base text-foreground/60 leading-relaxed mb-7 max-w-lg">
            {feature.lede}
          </p>
          <ul className="space-y-2.5">
            {feature.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-[13.5px] text-foreground/75 leading-[1.55]">
                <span className="mt-[9px] w-1 h-1 rounded-full bg-foreground/40 shrink-0" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-[440px] aspect-[16/11] rounded-lg border border-border bg-card/30 p-6 text-foreground">
            <Visual type={feature.visual} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const FeaturesSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHeaderVisible(true);
      },
      { threshold: 0.1 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="relative py-20 lg:py-28">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div
          className={`max-w-2xl mb-6 transition-all duration-500 ${
            headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <p className="text-[12px] text-foreground/50 uppercase tracking-[0.14em] font-medium mb-4">
            Capabilities
          </p>
          <h2 className="text-[32px] md:text-[40px] lg:text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground mb-4">
            A gateway-native policy engine.
          </h2>
          <p className="text-lg text-foreground/60 leading-relaxed">
            Govern what the agent can call, observe every decision, and recover when a route halts
            mid-flight.
          </p>
        </div>

        <div>
          {FEATURES.map((feature, i) => (
            <FeatureRow key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};
