'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SavesTab from './SavesTab';
import WatchlistTab from './WatchlistTab';

type Tab = 'saves' | 'watchlist';
const TABS: { key: Tab; label: string }[] = [
  { key: 'saves', label: 'Collection' },
  { key: 'watchlist', label: 'Watchlist' },
];

function ProfileTabsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get('tab');
  const active: Tab = (TABS.find((t) => t.key === raw)?.key ?? 'saves') as Tab;

  const setTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'saves') params.delete('tab');
      else params.set('tab', tab);
      router.replace(`/profile${params.toString() ? `?${params}` : ''}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div>
      <div
        className="hide-scrollbar flex gap-1 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)' }}
            >
              {t.label}
              <span
                className="pointer-events-none absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-opacity"
                style={{ background: 'var(--accent)', opacity: isActive ? 1 : 0 }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {active === 'saves' && <SavesTab />}
        {active === 'watchlist' && <WatchlistTab />}
      </div>
    </div>
  );
}

export default function ProfileTabsClient() {
  return (
    <Suspense fallback={null}>
      <ProfileTabsInner />
    </Suspense>
  );
}
