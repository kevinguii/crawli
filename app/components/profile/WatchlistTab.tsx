'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Watchlist, Listing } from '@/lib/types';
import { PLATFORM_NAMES } from '@/lib/types';
import PlatformBadge from '@/app/components/PlatformBadge';
import { useWatchlist } from '@/app/components/WatchlistProvider';
import { useSaves } from '@/app/components/SavesProvider';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', JPY: '¥',
};

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Price unavailable';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function WatchlistTab() {
  const [rows, setRows] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ completed: number; total: number } | null>(null);
  const [refreshDone, setRefreshDone] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Watchlist | null>(null);
  const { hydrateUrls } = useWatchlist();
  const { hydrateUrls: hydrateSaveUrls } = useSaves();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        const res = await fetch(`/api/watchlist${params.toString() ? `?${params}` : ''}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (cancelled) return;
        const next: Watchlist[] = data.watchlist ?? [];
        setRows(next);
        const urls = next.map((w) => w.listing_url);
        hydrateUrls(urls);
        hydrateSaveUrls(urls);
      } catch {
        if (!cancelled) toast.error('Could not load watchlist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [debouncedSearch, hydrateUrls, hydrateSaveUrls]);

  const submitRemoveWatch = async (row: Watchlist) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    try {
      const res = await fetch(`/api/watchlist/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast('Removed from Watchlist', {
        style: { color: '#E24B4A', borderColor: '#E24B4A' },
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ),
      });
    } catch {
      setRows(prev);
      toast.error('Could not remove. Try again.');
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshDone(false);
    setRefreshProgress({ completed: 0, total: rows.length });
    try {
      const res = await fetch('/api/watchlist/refresh', { method: 'POST' });
      if (!res.ok || !res.body) throw new Error('refresh failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let updated = 0;
      let failed = 0;
      let finalRows: Watchlist[] | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: { type: string; total?: number; completed?: number; updated?: number; failed?: number; rows?: Watchlist[] };
          try {
            event = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (event.type === 'start' && typeof event.total === 'number') {
            setRefreshProgress({ completed: 0, total: event.total });
          } else if (event.type === 'progress' && typeof event.completed === 'number') {
            setRefreshProgress((prev) =>
              prev ? { ...prev, completed: event.completed as number } : prev
            );
          } else if (event.type === 'done') {
            updated = event.updated ?? 0;
            failed = event.failed ?? 0;
            finalRows = event.rows ?? [];
          }
        }
      }

      if (finalRows) setRows(finalRows);
      setRefreshDone(true);
      if (failed > 0) {
        toast.success(`Refreshed ${updated} listing${updated === 1 ? '' : 's'}`, {
          description: `${failed} couldn't be checked`,
        });
      } else {
        toast.success(`Refreshed ${updated} listing${updated === 1 ? '' : 's'}`);
      }
      setTimeout(() => {
        setRefreshProgress(null);
        setRefreshDone(false);
      }, 2000);
    } catch {
      toast.error('Refresh failed. Try again.');
      setRefreshProgress(null);
      setRefreshDone(false);
    } finally {
      setRefreshing(false);
    }
  };

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  const newestChecked = useMemo(() => {
    let best: string | null = null;
    for (const r of rows) {
      if (!r.last_checked_at) continue;
      if (!best || r.last_checked_at > best) best = r.last_checked_at;
    }
    return best;
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search watched listings..."
          className="input-base flex-1 rounded-lg px-4 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || rows.length === 0}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: '#ffffff',
          }}
        >
          {refreshing ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Refreshing…
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh prices
            </>
          )}
        </button>
      </div>

      {refreshProgress && (
        <div
          className="rounded-xl p-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="bar-track">
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width:
                  refreshProgress.total > 0
                    ? `${(refreshProgress.completed / refreshProgress.total) * 100}%`
                    : '0%',
                background: refreshDone ? 'var(--success)' : 'var(--accent)',
                transition: 'width 250ms ease, background 250ms ease',
              }}
            />
          </div>
          <p
            className="mt-2 text-[11px] font-medium"
            style={{
              color: refreshDone ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            {refreshDone
              ? 'All refreshed!'
              : `${refreshProgress.completed}/${refreshProgress.total} refreshed`}
          </p>
        </div>
      )}

      {rows.length > 0 && !refreshProgress && (
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Last refreshed: {newestChecked ? relativeTime(newestChecked) : 'never'}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          Loading watchlist…
        </div>
      ) : empty ? (
        <div
          className="rounded-2xl py-16 text-center text-sm"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-dim)' }}
        >
          {debouncedSearch
            ? `No watched listings matching "${debouncedSearch}".`
            : 'Nothing watched yet. Use the eye icon on a listing to start tracking 👁️'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((w) => (
            <WatchCard key={w.id} row={w} onRemove={() => setDeleteTarget(w)} />
          ))}
        </div>
      )}

      {deleteTarget && (
        <WatchDeleteModal
          row={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => submitRemoveWatch(deleteTarget).then(() => setDeleteTarget(null))}
        />
      )}
    </div>
  );
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      >
        {children}
      </div>
    </div>
  );
}

function WatchCard({ row, onRemove }: { row: Watchlist; onRemove: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { isSaved, toggleSave } = useSaves();
  const saved = isSaved(row.listing_url);

  const handleEye = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove();
  };

  const handleHeart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const asListing: Listing = {
      id: row.id,
      title: row.title,
      price: row.price_current ?? row.price_at_add,
      currency: row.currency,
      condition: null,
      seller: null,
      url: row.listing_url,
      image: row.image_url,
      platform: row.platform,
    };
    toggleSave(asListing);
  };

  const at = row.price_at_add;
  const cur = row.price_current;
  const hasDelta = at !== null && cur !== null && at !== cur;
  const deltaAbs = hasDelta ? (cur as number) - (at as number) : 0;
  const deltaPct = hasDelta && at ? Math.round((deltaAbs / (at as number)) * 100) : 0;
  const dropped = deltaAbs < 0;
  const symbol = CURRENCY_SYMBOLS[row.currency] ?? row.currency + ' ';

  return (
    <a
      href={row.listing_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl transition-all hover:opacity-90 hover:scale-[1.02]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {row.image_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.image_url}
            alt={row.title}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            No image
          </div>
        )}

        {row.is_sold && (
          <>
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(0, 0, 0, 0.15)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="rounded-full px-4 py-2 text-lg font-semibold uppercase tracking-wide"
                style={{ background: '#1f1f1f', color: '#ffffff' }}
              >
                Sold
              </span>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleHeart}
          aria-label={saved ? 'Remove from collection' : 'Save to collection'}
          aria-pressed={saved}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ background: 'rgba(0, 0, 0, 0.55)' }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={saved ? '#E24B4A' : 'none'}
            stroke={saved ? '#E24B4A' : '#ffffff'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleEye}
          aria-label="Remove from watchlist"
          className="absolute flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ right: '0.5rem', top: '3rem', background: 'rgba(0, 0, 0, 0.55)' }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" fill="var(--accent)" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <PlatformBadge platform={row.platform} className="self-start" />
        <p
          className="line-clamp-2 text-[13px] leading-snug"
          style={{ color: 'var(--text)' }}
          title={row.title}
        >
          {row.title}
        </p>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          {cur !== null ? (
            <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              {formatPrice(cur, row.currency)}
            </span>
          ) : at !== null ? (
            <span className="text-lg font-semibold" style={{ color: 'var(--text-dim)' }}>
              {formatPrice(at, row.currency)}
            </span>
          ) : (
            <span className="text-xs italic" style={{ color: 'var(--text-dim)' }}>
              Price unavailable
            </span>
          )}
          {row.currency && row.currency !== 'USD' && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
            >
              {row.currency}
            </span>
          )}
        </div>
        {hasDelta && cur !== null && (
          <p
            className="text-[11px] font-medium"
            style={{ color: dropped ? 'var(--success)' : '#E24B4A' }}
          >
            {dropped ? '▼' : '▲'} {dropped ? '-' : '+'}{symbol}{Math.abs(deltaAbs).toLocaleString('en-US', { maximumFractionDigits: 2 })} ({deltaPct >= 0 ? '+' : ''}{deltaPct}%) from {formatPrice(at, row.currency)}
          </p>
        )}
        {!hasDelta && at !== null && cur === null && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Original: {formatPrice(at, row.currency)}
          </p>
        )}
        <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
          watching since {new Date(row.created_at).toLocaleDateString()}
          {row.last_checked_at && ` · last refreshed ${relativeTime(row.last_checked_at)}`}
        </p>
      </div>
    </a>
  );
}

function WatchDeleteModal({
  row, onClose, onConfirm,
}: {
  row: Watchlist;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          Stop watching &quot;{row.title}&quot;?
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-lg leading-none"
          style={{ color: 'var(--text-dim)' }}
        >
          ×
        </button>
      </div>

      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        This item will be removed from your watchlist and price history will be cleared.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: '#E24B4A', color: '#fff' }}
        >
          {submitting ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </ModalShell>
  );
}
