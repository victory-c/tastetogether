import { ImageResponse } from 'next/og';

export const alt = 'TasteTogether — two tastes, one table';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#fbf6ee',
        padding: '72px 80px',
        position: 'relative',
        fontFamily: 'Georgia, serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: 170,
          top: 115,
          width: 400,
          height: 400,
          borderRadius: 400,
          background: 'rgba(255,90,54,0.22)',
          border: '3px solid rgba(255,90,54,0.45)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -20,
          top: 115,
          width: 400,
          height: 400,
          borderRadius: 400,
          background: 'rgba(90,84,245,0.20)',
          border: '3px solid rgba(90,84,245,0.45)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 250,
          top: 270,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 160,
          height: 90,
          borderRadius: 28,
          background: '#fffdf9',
          boxShadow: '0 20px 50px rgba(31,25,21,0.25)',
          fontSize: 54,
        }}
      >
        🍽️
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 640 }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#6c5f56', letterSpacing: 1 }}>TasteTogether</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 104, color: '#1f1915', lineHeight: 1, letterSpacing: -3 }}>Two tastes.</div>
          <div
            style={{
              fontSize: 104,
              lineHeight: 1.05,
              letterSpacing: -3,
              fontStyle: 'italic',
              backgroundImage: 'linear-gradient(100deg, #ff5a36 0%, #c447b8 50%, #5a54f5 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            One table.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: '#6c5f56', fontFamily: 'sans-serif', lineHeight: 1.35 }}>
            An AI dining agent that finds where two people&apos;s tastes meet — powered by Qloo&apos;s taste graph.
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
