'use client';

import { useState } from 'react';
import { POPULAR_SEARCHES } from './mockSearches';

export const MOCK_SEARCH_EVENT = 'crawli-mock-search';

export type MockSearchEventDetail = {
  query: string;
  // When true, caller is requesting curated data (chip click).
  // When false, free-form input — caller picks best match or falls back.
  fromChip: boolean;
};

function dispatchMockSearch(detail: MockSearchEventDetail) {
  window.dispatchEvent(new CustomEvent(MOCK_SEARCH_EVENT, { detail }));
  const el = document.getElementById('search-preview');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Hero() {
  const [query, setQuery] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    dispatchMockSearch({ query: trimmed, fromChip: false });
  }

  function handleChip(label: string, fullQuery: string) {
    setQuery(label);
    dispatchMockSearch({ query: fullQuery, fromChip: true });
  }

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(226,75,74,0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 30%, rgba(239,159,39,0.08), transparent 60%)',
        }}
      />
      <div className="relative mx-auto max-w-5xl px-5 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-20">
        <div className="text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent-text)',
              border: '1px solid var(--accent-soft)',
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            8 resale platforms, one search
          </span>

          <h1
            className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl"
            style={{ color: 'var(--text)', lineHeight: 1.05 }}
          >
            Stop checking 8 apps.{' '}
            <span
              style={{
                background:
                  'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Find the best resale price instantly.
            </span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl text-base sm:text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            Crawli searches Grailed, Depop, Poshmark, StockX, and more —
            simultaneously — so you never overpay again.
          </p>

          <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-2xl">
            <div
              className="flex items-center gap-2 rounded-2xl p-2 text-left shadow-lg"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                boxShadow:
                  '0 10px 40px -10px rgba(226,75,74,0.25), 0 4px 12px rgba(0,0,0,0.08)',
              }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center"
                style={{ color: 'var(--text-dim)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try: Stussy hoodie, Margiela Tabi, Nike basketball shorts…"
                className="flex-1 bg-transparent text-sm outline-none sm:text-base"
                style={{ color: 'var(--text)' }}
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white sm:px-5"
                style={{
                  background:
                    'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27)',
                }}
              >
                Search
              </button>
            </div>

            {/* Popular-search chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-dim)' }}
              >
                Try:
              </span>
              {POPULAR_SEARCHES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleChip(s.chipLabel, s.query)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--accent-soft)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--surface)';
                  }}
                >
                  {s.chipLabel}
                </button>
              ))}
            </div>

            <p
              className="mt-4 text-center text-xs"
              style={{ color: 'var(--text-dim)' }}
            >
              Free to start · No credit card required ·{' '}
              <a
                href="#how-it-works"
                className="underline-offset-2 transition-opacity hover:underline"
                style={{ color: 'var(--text-muted)' }}
              >
                See how it works
              </a>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
