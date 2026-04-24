import { CheckCircle2Icon } from 'lucide-react';
import { Reveal } from '@/components/landing/reveal';
import type { ReactNode } from 'react';

// Reusable pillar section. Alternating sides via `side` prop. Accent colour
// controls eyebrow + check-icon tint. Visual slot is a ReactNode so each
// pillar can render its own screenshot / SVG / secondary content.

export type PillarFeature = {
  title: string;
  detail: string;
};

export const Pillar = ({
  id,
  eyebrow,
  title,
  lede,
  features,
  visual,
  side,
  accent,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  features: PillarFeature[];
  visual: ReactNode;
  side: 'text-left' | 'text-right';
  accent: string;
}) => {
  const textCol = side === 'text-left' ? 'lg:order-1' : 'lg:order-2';
  const visualCol = side === 'text-left' ? 'lg:order-2' : 'lg:order-1';

  return (
    <section
      id={id}
      className="py-24 md:py-32 border-t border-border/50"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal className={`flex flex-col gap-6 ${textCol}`}>
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: accent }}
            >
              {eyebrow}
            </p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
              {title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              {lede}
            </p>
            <ul className="space-y-4 pt-2">
              {features.map((f) => (
                <li key={f.title} className="flex gap-3 items-start group">
                  <CheckCircle2Icon
                    className="size-5 shrink-0 mt-0.5 transition-colors"
                    style={{ color: accent }}
                    aria-hidden
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{f.title}</span>
                    <span className="text-sm text-muted-foreground leading-relaxed">
                      {f.detail}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal className={visualCol} delay={120}>
            {visual}
          </Reveal>
        </div>
      </div>
    </section>
  );
};
