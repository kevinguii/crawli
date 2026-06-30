'use client';

import { useEffect, useState } from 'react';
import ListingCard from '@/app/components/ListingCard';
import type { Listing } from '@/lib/types';
import type { SavedSearch } from './SearchAlertsTab';

interface AlertMatch {
  id: string;
  url: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  platform: string | null;
  seller: string | null;
  size: string | null;
  condition: string | null;
  color: string | null;
  found_at: string;
}

// Stored matches are a flat snapshot — adapt to the Listing shape ListingCard
// expects (using the row id as the listing key).
function toListing(m: AlertMatch): Listing {
  return {
    id: m.id,
    title: m.title ?? 'Item',
    price: m.price,
    currency: m.currency ?? 'USD',
    condition: m.condition,
    size: m.size,
    color: m.color,
    seller: m.seller,
    url: m.url,
    image: m.image,
    platform: m.platform ?? '',
  };
}

interface Props {
  alert: SavedSearch;
  onClose: () => void;
}

export default function AlertMatchesModal({ alert, onClose }: Props) {
  const [matches, setMatches] = useState<AlertMatch[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/saved-searches/${alert.id}/matches`);
      const data = res.ok ? await res.json() : [];
      if (!cancelled) setMatches(data);
    })();
    // Opening the view = the user has reviewed these matches. Clears the per-alert
    // unread badge (Realtime then syncs the card).
    void fetch(`/api/saved-searches/${alert.id}/mark-seen`, { method: 'POST' });
    return () => { cancelled = true; };
  }, [alert.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      >
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Matched listings
            </h2>
            <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{alert.query}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 text-sm px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            Close
          </button>
        </div>

        {matches === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No matches stored yet. New listings will appear here after the next daily check finds them.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {matches.map((m) => (
              <ListingCard key={m.id} listing={toListing(m)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
