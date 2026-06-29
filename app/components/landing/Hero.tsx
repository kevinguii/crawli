'use client';

import { useState } from 'react';
import { POPULAR_SEARCHES } from './mockSearches';

export const MOCK_SEARCH_EVENT = 'crawli-mock-search';

export type MockSearchEventDetail = {
  query: string;
  fromChip: boolean;
};

function dispatchMockSearch(detail: MockSearchEventDetail) {
  window.dispatchEvent(new CustomEvent(MOCK_SEARCH_EVENT, { detail }));
  const el = document.getElementById('search-preview');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const PILLARS = [
  {
    label: 'Cross-platform comp in seconds',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 17l6-6 4 4 7-8" /><path d="M14 7h6v6" />
      </svg>
    ),
  },
  {
    label: 'Net flip profit after fees',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" />
      </svg>
    ),
  },
  {
    label: 'Alerts the moment deals land',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

export default function Hero() {
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  const activeChip = activeChipId
    ? POPULAR_SEARCHES.find((s) => s.id === activeChipId) ?? null
    : null;
  const displayValue = activeChip?.chipLabel ?? '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChip) return;
    dispatchMockSearch({ query: activeChip.query, fromChip: true });
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
            Sourcing intelligence for resellers
          </span>

          <h1
            className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl"
            style={{ color: 'var(--text)', lineHeight: 1.05 }}
          >
            Stop guessing.{' '}
            <span
              style={{
                background:
                  'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Know your margin before you buy.
            </span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl text-base sm:text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            Search 9 resale platforms at once, see what the market is really paying, calculate your net flip profit after fees, and get alerted the moment underpriced inventory hits.
          </p>

          {/* Three value pillars */}
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            {PILLARS.map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {icon}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-3xl">
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
                value={displayValue}
                readOnly
                placeholder="Pick a sample search below ↓"
                aria-label="Sample search query"
                className="flex-1 cursor-default bg-transparent text-sm outline-none sm:text-base"
                style={{ color: 'var(--text)' }}
                onMouseDown={(e) => e.preventDefault()}
              />
              <button
                type="submit"
                disabled={!activeChip}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity sm:px-5"
                style={{
                  background:
                    'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27)',
                  opacity: activeChip ? 1 : 0.45,
                  cursor: activeChip ? 'pointer' : 'not-allowed',
                }}
              >
                Search
              </button>
            </div>

            {/* Popular-search chips — single row, scrollable on overflow */}
            <div
              className="mt-4 flex items-center gap-2 overflow-x-auto px-1 hide-scrollbar sm:justify-center"
            >
              {POPULAR_SEARCHES.map((s) => {
                const active = s.id === activeChipId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveChipId(s.id)}
                    className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                    style={
                      active
                        ? {
                            background: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            color: '#fff',
                          }
                        : {
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                          }
                    }
                  >
                    {s.chipLabel}
                  </button>
                );
              })}
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
