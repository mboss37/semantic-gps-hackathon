import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// Dynamic favicon. Renders the BrandMark concept (gradient circle + center
// dot) at 32×32. ImageResponse can't render SVG strokes cleanly at this size,
// so the radar arcs are simplified to a ring + dot. Kills the Next.js
// boilerplate `app/favicon.ico` and keeps the favicon in lockstep with
// `components/brand-mark.tsx`.

const Icon = () =>
  new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #7dd3fc 0%, #6366f1 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'white',
            }}
          />
        </div>
      </div>
    ),
    size,
  );

export default Icon;
