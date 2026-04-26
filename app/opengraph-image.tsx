import { ImageResponse } from 'next/og';

// Dynamic OG image. 1200x630 (Open Graph + Twitter summary_large_image
// canonical size). Reused for /twitter-image via metadata config so we
// only maintain one source of truth.

export const runtime = 'edge';
export const alt = 'Semantic GPS, mission control for AI agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const Image = () =>
  new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(ellipse at top left, rgba(125,211,252,0.18) 0%, transparent 55%), radial-gradient(ellipse at bottom right, rgba(37,99,235,0.22) 0%, transparent 55%), #02040a',
          color: 'white',
          padding: '80px 88px',
          position: 'relative',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Brand row: gradient mark + name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #7dd3fc 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 18px 48px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                background: 'white',
                clipPath:
                  'polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Semantic GPS
          </div>
        </div>

        {/* Eyebrow pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 110,
            padding: '10px 18px',
            border: '1px solid rgba(125,211,252,0.35)',
            background: 'rgba(125,211,252,0.06)',
            borderRadius: 999,
            fontSize: 20,
            color: 'rgba(255,255,255,0.85)',
            width: 'fit-content',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: '#34d399',
            }}
          />
          Enterprise MCP governance
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
            marginTop: 28,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>Mission control</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>for AI agents.</span>
        </div>

        {/* Footer row: tagline + url */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 'auto',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 22,
            letterSpacing: '0.01em',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>Live policies. Saga rollback. Audit on every call.</div>
            <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 18 }}>
              Built with Claude Opus 4.7
            </div>
          </div>
          <div
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "Menlo", monospace',
              fontSize: 18,
              color: 'rgba(125,211,252,0.85)',
            }}
          >
            semantic-gps-hackathon.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );

export default Image;
