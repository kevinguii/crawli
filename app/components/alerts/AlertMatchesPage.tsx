'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export default function AlertMatchesPage({ alertId }: { alertId: string }) {
  const [alert, setAlert] = useState<SavedSearch | null | undefined>(undefined);
  const [matches, setMatches] = useState<AlertMatch[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [alertRes, matchesRes, historyRes] = await Promise.all([
        fetch(`/api/saved-searches/${alertId}`),
        fetch(`/api/saved-searches/${alertId}/matches`),
        fetch(`/api/saved-searches/${alertId}/history`),
      ]);
      const alertData = alertRes.ok ? await alertRes.json() : null;
      const matchesData = matchesRes.ok ? await matchesRes.json() : [];
      const historyData: HistoryEntry[] = historyRes.ok ? await historyRes.json() : [];
      if (!cancelled) {
        setAlert(alertData);
        setMatches(matchesData);
        setHistory(historyData);
        // history is newest-first — open just the latest run by default.
        if (historyData.length > 0) setExpanded(new Set([historyData[0].id]));
      }
    })();
    // Opening the page = the user has reviewed these matches. Clears the per-alert
    // unread badge (Realtime then syncs the card).
    void fetch(`/api/saved-searches/${alertId}/mark-seen`, { method: 'POST' });
    return () => { cancelled = true; };
  }, [alertId]);

  function toggleRun(runId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId); else next.add(runId);
      return next;
    });
  }

  // Matches accumulate (deduped against last_seen_urls, not by run) but are
  // pruned to the most recent 500 — group by the run that found them so a run
  // with new_count > 0 whose matches have since been pruned still shows in
  // history, just without cards.
  const matchesByRun = (matches ?? []).reduce<Record<string, AlertMatch[]>>((acc, m) => {
    if (!m.notification_id) return acc;
    (acc[m.notification_id] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div>
      <Link
        href="/alerts?tab=search"
        className="inline-flex items-center gap-1 text-sm mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Back to alerts
      </Link>

      {alert === undefined || matches === null || history === null ? (
        <>
          <div className="h-7 w-64 rounded animate-pulse mb-6" style={{ background: 'var(--surface)' }} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        </>
      ) : alert === null ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Alert not found.
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              {alert.query}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Checks {cadenceLabel(alert.cadence_hours).toLowerCase()}
            </p>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No checks run yet. This alert runs {cadenceLabel(alert.cadence_hours).toLowerCase()} — results will appear here after the next check.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((run) => {
                const runMatches = matchesByRun[run.id] ?? [];
                const isOpen = expanded.has(run.id);
                return (
                  <div key={run.id} className="rounded-xl" style={{ border: '1px solid var(--border-strong)' }}>
                    <button
                      type="button"
                      onClick={() => toggleRun(run.id)}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
                        <span
                          className="inline-block transition-transform"
                          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          ›
                        </span>
                        {formatRunDate(run.created_at)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {run.new_count === 0 ? 'No new matches' : `${run.new_count} new`}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        {runMatches.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {runMatches.map((m) => (
                              <ListingCard key={m.id} listing={toListing(m)} />
                            ))}
                          </div>
                        ) : run.new_count > 0 ? (
                          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            No longer available — beyond the most recent 500 matches stored.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
