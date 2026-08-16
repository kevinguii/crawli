'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Wordmark from './Wordmark';
import CtaLink from './CtaLink';

export default function LandingNav({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  // LandingNav renders on "/" and on blog pages — read the real current
  // path so the pricing page's close button returns to whichever one.
  const pathname = usePathname();

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
          <Wordmark size={30} />
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/compare"
            className="hidden text-sm font-medium transition-opacity hover:opacity-80 sm:inline-block"
            style={{ color: 'var(--text-muted)' }}
          >
            Compare
          </Link>
          <Link
            href="/blog"
            className="hidden text-sm font-medium transition-opacity hover:opacity-80 sm:inline-block"
            style={{ color: 'var(--text-muted)' }}
          >
            Blog
          </Link>
          <Link
            href={`/pricing?from=${encodeURIComponent(pathname)}`}
            className="hidden text-sm font-medium transition-opacity hover:opacity-80 sm:inline-block"
            style={{ color: 'var(--text-muted)' }}
          >
            Pricing
          </Link>
          {isAuthenticated ? (
            <Link
              href="/search"
              className="btn-filled-grey rounded-lg px-3.5 py-2 text-sm font-medium sm:px-4"
            >
              Go to app
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: 'var(--text)' }}
              >
                Log in
              </Link>
              <CtaLink
                location="nav"
                className="btn-primary whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium sm:px-4"
              >
                Sign up
              </CtaLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
