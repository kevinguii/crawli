'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { track, type PaywallSurface } from '@/lib/analytics';

/**
 * Blurs `children` and lays a crisp upgrade prompt on top of it.
 *
 * The blur is presentation, not protection: any CSS filter can be removed from
 * devtools in one click, so `children` must NEVER contain real data — only
 * fabricated stand-ins (see lib/fakePricing.ts). The actual numbers for a free
 * user are stripped out server-side before they ever reach the browser (see
 * /api/sold-comps), so there is nothing here for an inspect-and-unblur attempt
 * to recover regardless of what happens to the filter.
 *
 * The backdrop is `inert` + `aria-hidden` + `pointer-events: none`: it cannot be
 * focused, clicked, or announced. The overlay text and CTA are the only
 * interactive/accessible content.
 */
export default function LockedOverlay({
  surface,
  title,
  body,
  cta = 'Upgrade to Pro',
  children,
}: {
  surface: PaywallSurface;
  title: string;
  body: string;
  cta?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    track({ name: 'paywall_view', params: { surface } });
  }, [surface]);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden="true"
        inert
        style={{ filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none' }}
      >
        {children}
      </div>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 py-6 text-center"
        style={{ background: 'color-mix(in srgb, var(--bg) 62%, transparent)' }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--text-muted)' }}
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </p>
        <p className="max-w-[22rem] text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {body}
        </p>
        <Link
          href="/pricing"
          onClick={() => track({ name: 'upgrade_click', params: { surface } })}
          className="mt-1 inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
