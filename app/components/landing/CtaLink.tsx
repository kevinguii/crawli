'use client';

import Link from 'next/link';
import { track, type CtaLocation } from '@/lib/analytics';

/**
 * The unified "Sign up" action, wrapped so every instance reports
 * where it was clicked. Landing sections are server components, so the click
 * handler has to live in a client boundary like this one rather than on the
 * sections themselves.
 *
 * Fires on click and lets navigation proceed — no preventDefault, no await. A
 * dropped beacon is an acceptable loss; a delayed signup is not.
 */
export default function CtaLink({
  location,
  href = '/login?tab=signup',
  className,
  style,
  children,
}: {
  location: CtaLocation;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => track({ name: 'cta_click', params: { location } })}
    >
      {children}
    </Link>
  );
}
