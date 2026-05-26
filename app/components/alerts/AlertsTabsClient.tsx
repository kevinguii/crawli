'use client';

import { useState } from 'react';
import WatchlistTab from '@/app/components/profile/WatchlistTab';
import SearchAlertsTab from './SearchAlertsTab';

type Tab = 'tracked' | 'search';

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: 'tracked',
    label: 'Tracked items',
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

  return (
    <div>
      <div
        className="flex gap-1 mb-8 p-1 rounded-lg w-fit"
        style={{ background: 'var(--surface)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={
              active === t.id
                ? {
                    background: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  }
                : { color: 'var(--text-muted)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        {TABS.find((t) => t.id === active)?.description}
      </p>

      {active === 'tracked' && <WatchlistTab />}
      {active === 'search' && <SearchAlertsTab />}
    </div>
  );
}
