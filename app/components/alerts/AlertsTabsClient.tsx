'use client';

import { useCallback, useEffect, useState } from 'react';
import WatchlistTab from '@/app/components/profile/WatchlistTab';
import SearchAlertsTab from './SearchAlertsTab';

type Tab = 'tracked' | 'search';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tracked', label: 'Tracked listings' },
  { id: 'search', label: 'Search alerts' },
];

export default function AlertsTabsClient({ initialTab }: { initialTab: Tab }) {
  const [active, setActive] = useState<Tab>(initialTab);
  const [counts, setCounts] = useState<{ tracked: number | null; search: number | null }>({
    tracked: null,
    search: null,
  });

  // Visiting the alerts area = the user has seen the bell. Clear unseen
  // notifications so the nav badge resets (Realtime then updates the bell).
  useEffect(() => {
    void fetch('/api/notifications/mark-seen', { method: 'POST' });
  }, []);

  // Stable identity so the child's onCount effect only reruns when the
  // count actually changes, not on every AlertsTabsClient render.
  const onTrackedCount = useCallback((n: number) => {
    setCounts((c) => (c.tracked === n ? c : { ...c, tracked: n }));
  }, []);
  const onSearchCount = useCallback((n: number) => {
    setCounts((c) => (c.search === n ? c : { ...c, search: n }));
  }, []);

  return (
    <div>
      {/* Segmented pill tabs with live count badges */}
      <div
        className="mb-6 inline-flex gap-1 rounded-xl p-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {TABS.map((t) => {
          const isActive = active === t.id;
          const count = counts[t.id];
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
              {count !== null && count > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                  style={{
                    background: isActive ? 'var(--accent-soft)' : 'var(--surface-hover)',
                    color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Both tabs stay mounted so their count badges populate up-front; we
          toggle visibility instead of unmounting to preserve state. */}
      <div style={{ display: active === 'tracked' ? 'block' : 'none' }}>
        <WatchlistTab onCount={onTrackedCount} />
      </div>
      <div style={{ display: active === 'search' ? 'block' : 'none' }}>
        <SearchAlertsTab onCount={onSearchCount} />
      </div>
    </div>
  );
}
