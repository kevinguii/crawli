'use client';

import { useEffect, useState } from 'react';
import ListingCard from '@/app/components/ListingCard';
import type { Listing } from '@/lib/types';
import type { SavedSearch } from './SearchAlertsTab';
import { cadenceLabel } from '@/lib/alertSchedule';

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
  notification_id: string | null;
}

interface HistoryEntry {
  id: string;
  new_count: number;
  created_at: string;
}

function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [matchesRes, historyRes] = await Promise.all([
        fetch(`/api/saved-searches/${alert.id}/matches`),
        fetch(`/api/saved-searches/${alert.id}/history`),
      ]);
      const matchesData = matchesRes.ok ? await matchesRes.json() : [];
      const historyData = historyRes.ok ? await historyRes.json() : [];
      if (!cancelled) {
        setMatches(matchesData);
        setHistory(historyData);
      }
    })();
    // Opening the view = the user has reviewed these matches. Clears the per-alert
    // unread badge (Realtime then syncs the card).
    void fetch(`/api/saved-searches/${alert.id}/mark-seen`, { method: 'POST' });
    return () => { cancelled = true; };
  }, [alert.id]);

  // Matches accumulate (deduped against last_seen_urls, not by run) but are
  // pruned to the most recent 100 — group by the run that found them so a run
  // with new_count > 0 whose matches have since been pruned still shows in
  // history, just without cards.
  const matchesByRun = (matches ?? []).reduce<Record<string, AlertMatch[]>>((acc, m) => {
    if (!m.notification_id) return acc;
    (acc[m.notification_id] ??= []).push(m);
    return acc;
  }, {});

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

        {matches === null || history === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No checks run yet. This alert runs {cadenceLabel(alert.cadence_hours).toLowerCase()} — results will appear here after the next check.
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((run) => {
              const runMatches = matchesByRun[run.id] ?? [];
              return (
                <div key={run.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {formatRunDate(run.created_at)}
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {run.new_count === 0 ? 'No new matches' : `${run.new_count} new`}
                    </span>
                  </div>
                  {runMatches.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {runMatches.map((m) => (
                        <ListingCard key={m.id} listing={toListing(m)} />
                      ))}
                    </div>
                  ) : run.new_count > 0 ? (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      No longer available — beyond the most recent 100 matches stored.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
