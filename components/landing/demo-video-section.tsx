import { PlayIcon } from 'lucide-react';

// Sprint 21 WP-21.4: video slot anchored at #demo. Hero's "Watch the
// 3-minute demo" CTA links here. Set NEXT_PUBLIC_DEMO_VIDEO_URL at build
// time to embed the recorded walkthrough; otherwise renders a brand-tinted
// placeholder so the slot is always reserved (no layout shift on launch).

export const DemoVideoSection = () => {
  const url = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

  return (
    <section id="demo" className="relative py-20 lg:py-28 px-6 lg:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <p className="text-xs font-mono text-foreground/55 uppercase tracking-[0.18em] mb-3">
            See it run
          </p>
          <h2
            className="font-medium tracking-[-0.025em] leading-[1.05]"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}
          >
            Three minutes, one gateway,
            <br />
            <span className="text-foreground/55">every policy in motion.</span>
          </h2>
        </div>

        <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-card shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
          {url ? (
            <iframe
              src={url}
              title="Semantic GPS demo"
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground/55">
              <div className="flex items-center justify-center w-16 h-16 rounded-full border border-foreground/15 bg-background/40 backdrop-blur-sm">
                <PlayIcon className="size-7" />
              </div>
              <p className="text-sm font-medium">Demo video coming soon</p>
              <p className="text-xs text-foreground/40">
                Set NEXT_PUBLIC_DEMO_VIDEO_URL to embed
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
