'use client';

import { Suspense } from 'react';
import WatchlistTab from './WatchlistTab';

function ProfileTabsInner() {
  // Saves moved to /saves; only Watchlist remains here until it moves to /alerts.
  return (
    <div>
      <div
        className="hide-scrollbar flex gap-1 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="relative shrink-0 px-4 py-2.5 text-sm font-medium"
          style={{ color: 'var(--text)' }}
        >
          Watchlist
          <span
            className="pointer-events-none absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
        </div>
      </div>

      <div className="mt-6">
        <WatchlistTab />
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
