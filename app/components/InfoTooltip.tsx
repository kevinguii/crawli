'use client';

import { ReactNode } from 'react';

interface Props {
  content: ReactNode;
  label?: string;
}

export default function InfoTooltip({ content, label = 'More info' }: Props) {
  return (
    <span
      className="info-tooltip-root"
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}
    >
      <button
        type="button"
        aria-label={label}
        className="info-tooltip-trigger"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: '1px solid var(--text-dim)',
          color: 'var(--text-dim)',
          background: 'transparent',
          fontSize: '10px',
          fontWeight: 600,
          lineHeight: 1,
          cursor: 'help',
          padding: 0,
        }}
      >
        i
      </button>
      <span
        role="tooltip"
        className="info-tooltip-bubble"
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: '220px',
          maxWidth: '280px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          color: 'var(--text)',
          fontSize: '12px',
          lineHeight: 1.5,
          fontWeight: 400,
          textAlign: 'left',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.12s ease',
          zIndex: 50,
        }}
      >
        {content}
      </span>
      <style jsx>{`
        .info-tooltip-root:hover .info-tooltip-bubble,
        .info-tooltip-root:focus-within .info-tooltip-bubble {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </span>
  );
}
