'use client';

import { useEffect, useState } from 'react';
import WatchlistTab from '@/app/components/profile/WatchlistTab';
import SearchAlertsTab from './SearchAlertsTab';

type Tab = 'tracked' | 'search';

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: 'tracked',
    label: 'Tracked listings',
    description: 'Listings you\'re watching. Refresh anytime to see the latest price or sold status.',
  },
  {
    id: 'search',
    label: 'Search alerts',
    description: 'Saved searches that run automatically and notify you when new listings appear.',
  },
];

export default function AlertsTabsClient({ initialTab }: { initialTab: Tab }) {
  const [active, setActive] = useState<Tab>(initialTab);

  const activeTab = TABS.find((t) => t.id === active)!;

  // Visiting the alerts area = the user has seen the bell. Clear unseen
  // notifications so the nav badge resets (Realtime then updates the bell).
  useEffect(() => {
    void fetch('/api/notifications/mark-seen', { method: 'POST' });
  }, []);

  return (
    <div>
      {/* Full-width tab bar — each tab takes 50% */}
      <div
        className="flex w-full"
        style={{ borderBottom: '2px solid var(--border)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className="flex-1 px-5 py-3 text-sm font-medium transition-all text-center"
            style={{
              color: active === t.id ? 'var(--text)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Section header — description centered horizontally */}
      <div
        className="py-5 text-center"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <p className="text-sm mx-auto max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          {activeTab.description}
        </p>
      </div>

      {/* Content */}
      <div className="pt-6">
        {active === 'tracked' && <WatchlistTab />}
        {active === 'search' && <SearchAlertsTab />}
      </div>
    </div>
  );
}
