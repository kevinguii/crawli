'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Wordmark from './Wordmark';

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: 'color-mix(in srgb, var(--bg) 75%, transparent)',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'border-color 200ms ease',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center">
          <Wordmark size={28} />
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/pricing"
            className="hidden text-sm font-medium transition-opacity hover:opacity-80 sm:inline-block"
            style={{ color: 'var(--text-muted)' }}
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--text)' }}
          >
            Log in
          </Link>
          <Link
            href="/login?tab=signup"
            className="btn-primary rounded-lg px-3.5 py-2 text-sm font-medium sm:px-4"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
