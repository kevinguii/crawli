'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import PlatformBadge from '@/app/components/PlatformBadge';
import type { CompareHeroItem } from '@/lib/compare';

const ROTATE_MS = 4500;
const FADE_MS = 200;

function fmtPrice(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function EmptyState() {
  return (
    <div
      className="w-full rounded-2xl p-5 text-left sm:p-6"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 20px 50px -20px rgba(226,75,74,0.28), 0 4px 12px rgba(0,0,0,0.06)',
      }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        Live price comparison
      </p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        Real cross-platform prices are updating. Check back in a moment, or
        see the full grid below.
      </p>
      <a
        href="#compare"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        Browse compare items ↓
      </a>
    </div>
  );
}

export default function CompareHeroWidget({ items }: { items: CompareHeroItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  useEffect(() => {
    if (items.length < 2 || paused || reducedMotion.current) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActiveIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [items.length, paused]);

  if (items.length === 0) return <EmptyState />;

  const active = items[activeIndex];
  const cheapest = active.platforms[0];

  function selectItem(index: number) {
    if (index === activeIndex) return;
    if (reducedMotion.current) {
      setActiveIndex(index);
      return;
    }
    setVisible(false);
    setTimeout(() => {
      setActiveIndex(index);
      setVisible(true);
    }, FADE_MS);
  }

  return (
    <div
      className="w-full rounded-2xl p-5 text-left sm:p-6"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 20px 50px -20px rgba(226,75,74,0.28), 0 4px 12px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 17l6-6 4 4 7-8" /><path d="M14 7h6v6" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Live price comparison</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Prices update daily · no login</p>
        </div>
      </div>

      <div style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-out` }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{active.name}</p>

        <div className="mt-3 space-y-1.5">
          {active.platforms.map((p) => {
            const isCheapest = p.platform === cheapest.platform;
            return (
              <div
                key={p.platform}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
                style={{
                  background: isCheapest ? 'var(--accent-soft)' : 'var(--surface)',
                  border: `1px solid ${isCheapest ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <PlatformBadge platform={p.platform} />
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: isCheapest ? 'var(--accent-text)' : 'var(--text)' }}
                >
                  {fmtPrice(p.avgPriceUsd)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => selectItem(i)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              background: i === activeIndex ? 'var(--accent)' : 'var(--surface)',
              color: i === activeIndex ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${i === activeIndex ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      <Link
        href={`/compare/${active.slug}`}
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27)',
          color: '#fff',
        }}
      >
        See full breakdown
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}
