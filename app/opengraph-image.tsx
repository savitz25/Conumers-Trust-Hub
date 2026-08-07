import { ImageResponse } from 'next/og';

export const alt = 'Ask Trust Hub — independent consumer research for moving, insurance & lending';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Homepage / default Open Graph image (1200×630) — not a logo-only crop.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(145deg, #0A2540 0%, #1E3A8A 48%, #4F46E5 100%)',
          color: '#FFFFFF',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#C7D2FE',
          }}
        >
          Ask Trust Hub
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 920 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
            }}
          >
            Independent consumer research for moving, insurance &amp; lending
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              lineHeight: 1.4,
              color: '#E0E7FF',
              maxWidth: 880,
            }}
          >
            We cite. You decide. · Common ownership · Separated research and listing order · No paid
            placements
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 20,
            color: '#C7D2FE',
          }}
        >
          <span>Move · Insurance · Lender Trust Hub</span>
          <span>asktrusthub.com</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
