'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PlatformBadge from '@/app/components/PlatformBadge';
import MockFrame from './MockFrame';
import {
  MOCK_SEARCH_EVENT,
  type MockSearchEventDetail,
} from './Hero';
import {
  DEFAULT_MOCK,
  findMockMatch,
  type MockListing,
  type MockSearch,
} from './mockSearches';

type DisplayState = {
  query: string;
  results: MockListing[];
  matched: boolean; // true when query matched a curated search
};

function stateFor(detail: MockSearchEventDetail): DisplayState {
  const match = findMockMatch(detail.query);
  if (match) {
    return { query: match.query, results: match.results, matched: true };
  }
  // Free-form query with no curated match: keep their query in the header,
  // but show the default sample data and label it as a sample.
  return {
    query: detail.query,
    results: DEFAULT_MOCK.results,
    matched: false,
  };
}

function initialState(): DisplayState {
  return { query: DEFAULT_MOCK.query, results: DEFAULT_MOCK.results, matched: true };
}

export default function SearchMock() {
  const [state, setState] = useState<DisplayState>(initialState);

  useEffect(() => {
    function onSearch(e: Event) {
      const detail = (e as CustomEvent<MockSearchEventDetail>).detail;
      setState(stateFor(detail));
    }
    window.addEventListener(MOCK_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(MOCK_SEARCH_EVENT, onSearch);
  }, []);

  const urlQuery = encodeURIComponent(state.query).replace(/%20/g, '+');

  return (
    <section id="search-preview" className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--accent-text)' }}
          >
            One search. Every platform.
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            Live prices, side-by-side, ranked.
          </h2>
        </div>

        <div className="mt-12">
          <MockFrame url={`thecrawli.com/search?q=${urlQuery}`}>
            {/* Query echo bar */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="min-w-0">
                <p
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {state.matched ? 'Results for' : 'Sample results · sign up to search live'}
                </p>
                <p
                  className="truncate text-sm font-semibold sm:text-base"
                  style={{ color: 'var(--text)' }}
                >
                  {state.query}
                </p>
              </div>
              <span
                className="hidden flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-block"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-text)',
                }}
              >
                8 platforms searched
              </span>
            </div>

            {/* Gated results grid */}
            <div className="relative p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {state.results.map((l, i) => {
                  const blurred = i >= 2;
                  return (
                    <div
                      key={`${state.query}-${i}`}
                      className="overflow-hidden rounded-xl"
                      style={{
                        background: 'var(--surface)',
                        border: l.lowest
                          ? '1px solid var(--success)'
                          : '1px solid var(--border)',
                        boxShadow: l.lowest
                          ? '0 0 0 3px var(--success-soft)'
                          : 'none',
                        filter: blurred ? 'blur(6px)' : 'none',
                        opacity: blurred ? 0.7 : 1,
                        userSelect: blurred ? 'none' : 'auto',
                        pointerEvents: blurred ? 'none' : 'auto',
                      }}
                      aria-hidden={blurred}
                    >
                      <div
                        className="relative h-32 w-full"
                        style={{
                          background:
                            'linear-gradient(135deg, var(--surface-hover), var(--track))',
                        }}
                      >
                        {l.lowest && (
                          <span
                            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                            style={{ background: 'var(--success)' }}
                          >
                            Lowest price
                          </span>
                        )}
                        <div className="absolute right-2 top-2">
                          <PlatformBadge platform={l.platform} />
                        </div>
                      </div>
                      <div className="p-3">
                        <p
                          className="line-clamp-2 text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {l.title}
                        </p>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span
                            className="text-lg font-bold"
                            style={{ color: 'var(--text)' }}
                          >
                            {l.price}
                          </span>
                          <span
                            className="text-[10px] font-medium uppercase tracking-wide"
                            style={{ color: 'var(--text-dim)' }}
                          >
                            Size {l.size}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sign-up gate overlay */}
              <div className="pointer-events-none absolute inset-x-5 bottom-5 flex items-end justify-center">
                <div
                  className="pointer-events-auto w-full max-w-md rounded-2xl px-6 py-5 text-center shadow-2xl"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--accent)',
                    boxShadow:
                      '0 20px 50px -10px rgba(226,75,74,0.35), 0 0 0 1px var(--accent-soft)',
                  }}
                >
                  <p
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text)' }}
                  >
                    Sign up to see all results across 8 platforms
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Free · 10 searches a month, no card required
                  </p>
                  <Link
                    href="/login?tab=signup"
                    className="btn-primary mt-3 inline-block rounded-lg px-5 py-2 text-sm font-semibold"
                  >
                    Try search now
                  </Link>
                </div>
              </div>
            </div>
          </MockFrame>
        </div>
      </div>
    </section>
  );
}
