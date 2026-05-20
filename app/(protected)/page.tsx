'use client';

import Link from 'next/link';
import SearchSection from '@/app/components/SearchSection';
import ThemeToggle from '@/app/components/ThemeToggle';
import AuthButton from '@/app/components/AuthButton';

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Top nav */}
      <nav
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          borderBottom: '1px solid rgba(226, 75, 74, 0.22)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center">
            <span
              style={{
                fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.2,
              }}
            >
              Crawli
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ color: 'var(--text)' }}
            >
              Find the best resale price.
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              One search — live pricing across Grailed, Depop, StockX, Poshmark, Mercari, Vinted, eBay, and Vestiaire.
            </p>
          </div>
          <Link
            href="/search-history"
            className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted, var(--text))',
            }}
            title="Search history"
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </Link>
        </div>

        <SearchSection />
      </div>
    </main>
  );
}
