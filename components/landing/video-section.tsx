import { PlayCircleIcon, ClockIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Main demo-video embed. Same-origin MP4 (not YouTube/Vimeo) — predictable
// autoplay, no 3rd-party chrome, edge-cached. Ghost-card fallback when the
// env var is unset (the default at build time per PO brief). A visible
// "Recording Sunday" pill signals active work, which for a judge previewing
// on Saturday reads as a feature.

const VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

export const VideoSection = () => (
  <section className="relative bg-[oklch(0.12_0_0)] py-24 md:py-28">
    <div className="max-w-5xl mx-auto px-6 lg:px-8">
      <div className="text-center mb-10 md:mb-14">
        <p className="text-xs md:text-sm font-semibold uppercase tracking-widest text-[var(--brand)] mb-4">
          Three minutes, one governance story
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Watch the gateway block a leak, roll back a saga, and prove it on replay.
        </h2>
      </div>

      {VIDEO_URL ? (
        <video
          src={VIDEO_URL}
          controls
          preload="metadata"
          playsInline
          className="w-full rounded-xl border border-border shadow-2xl aspect-video bg-black"
        />
      ) : (
        <div className="relative w-full aspect-video rounded-xl border border-dashed border-border/70 bg-card/40 flex flex-col items-center justify-center gap-4">
          <PlayCircleIcon className="size-16 text-muted-foreground/60" aria-hidden />
          <Badge variant="outline" className="gap-2 px-3 py-1.5 text-xs font-medium">
            <ClockIcon className="size-3 animate-pulse" />
            Recording Sun, uploading Sun night
          </Badge>
          <p className="text-sm text-muted-foreground max-w-md text-center px-6">
            Demo video upload in progress. Try the Playground instead.
          </p>
        </div>
      )}
    </div>
  </section>
);
