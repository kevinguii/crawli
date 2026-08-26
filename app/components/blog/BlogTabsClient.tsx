'use client';

import { useState, type ReactNode } from 'react';

type Tab = 'all' | 'price-guides';

export default function BlogTabsClient({
  allCount,
  priceGuidesCount,
  allPosts,
  priceGuides,
}: {
  allCount: number;
  priceGuidesCount: number;
  allPosts: ReactNode;
  priceGuides: ReactNode;
}) {
  const [active, setActive] = useState<Tab>('all');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All Posts', count: allCount },
    { id: 'price-guides', label: 'Price Guides', count: priceGuidesCount },
  ];

  return (
    <div>
      {/* Segmented pill tabs with count badges, mirrors AlertsTabsClient */}
      <div
        className="mb-8 inline-flex gap-1 rounded-xl p-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                boxShadow: isActive ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
              }}
            >
              {t.label}
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                style={{
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface-hover)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Both lists stay mounted (already server-rendered) so both are present
          in the initial HTML for crawlers regardless of which tab is active;
          we only toggle visibility, no client fetch. */}
      <div style={{ display: active === 'all' ? 'block' : 'none' }}>{allPosts}</div>
      <div style={{ display: active === 'price-guides' ? 'block' : 'none' }}>{priceGuides}</div>
    </div>
  );
}
