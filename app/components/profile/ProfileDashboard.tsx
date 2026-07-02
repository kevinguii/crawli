'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchHistory } from '@/app/components/SearchHistoryProvider';
import { PLATFORM_NAMES } from '@/lib/types';
import type { SearchHistoryItem, Save, Watchlist } from '@/lib/types';

// Prefill only — SearchForm fills the form without auto-running
const PREFILL_SEARCH_KEY = 'crawli_prefill_search';

interface Stats {
  searchesThisMonth: number;
  totalSaves: number;
  totalWatching: number;
  activeAlerts: number;
  topPlatforms: { platform: string; count: number }[];
}

// ─── Stats strip ────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
        {value === null ? (
          <span className="inline-block h-7 w-12 animate-pulse rounded" style={{ background: 'var(--border)' }} />
        ) : value.toLocaleString()}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function StatsStrip({ stats }: { stats: Stats | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Searches this month" value={stats?.searchesThisMonth ?? null} />
      <StatCard label="Items saved" value={stats?.totalSaves ?? null} />
      <StatCard label="Listings watched" value={stats?.totalWatching ?? null} />
      <StatCard label="Active alerts" value={stats?.activeAlerts ?? null} />
    </div>
  );
}

// ─── Recent searches ─────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function RecentSearches() {
  const { items, loading } = useSearchHistory();
  const router = useRouter();
  const recent = items.slice(0, 8);

  function rerun(item: SearchHistoryItem) {
    sessionStorage.setItem(PREFILL_SEARCH_KEY, JSON.stringify(item));
    router.push('/search');
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recent searches</h2>
        <Link
          href="/search-history"
          className="text-xs hover:underline underline-offset-2"
          style={{ color: 'var(--text-muted)' }}
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          No searches yet. Run a search to see it here.
        </p>
      ) : (
        <ul className="space-y-1">
          {recent.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => rerun(item)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {item.query}
                  </span>
                  <span className="hidden shrink-0 truncate text-[11px] sm:inline" style={{ color: 'var(--text-dim)', maxWidth: '45%' }}>
                    {item.platforms.map((p) => PLATFORM_NAMES[p] ?? p).join(', ')}
                  </span>
                </span>
                <span className="shrink-0 text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  {relativeTime(item.searched_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Top platforms ────────────────────────────────────────────────────────────

function TopPlatforms({ stats }: { stats: Stats | null }) {
  const platforms = stats?.topPlatforms ?? [];

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text)' }}>
        Top saved platforms
      </h2>

      {stats === null ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      ) : platforms.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          Save some listings to see your top platforms.
        </p>
      ) : (
        <ul className="space-y-3">
          {platforms.map(({ platform, count }) => (
            <li key={platform} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {PLATFORM_NAMES[platform] ?? platform}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
              >
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Mini saves card ──────────────────────────────────────────────────────────

function MiniSavesCard() {
  const [saves, setSaves] = useState<Save[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/saves')
      .then((r) => r.json())
      .then((d) => {
        setSaves((d.saves ?? []).slice(0, 4));
        setTotal(d.total ?? d.saves?.length ?? 0);
      })
      .catch(() => {});
  }, []);

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recently saved</h2>
        <Link
          href="/saves"
          className="text-xs hover:underline underline-offset-2"
          style={{ color: 'var(--text-muted)' }}
        >
          View all
        </Link>
      </div>

      {saves.length === 0 && total === null ? (
        <div className="grid grid-cols-4 gap-1.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      ) : saves.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          Heart listings to save them here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {saves.map((s) => (
              <a
                key={s.id}
                href={s.listing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square overflow-hidden rounded-lg transition-opacity hover:opacity-80"
                style={{ background: 'var(--bg-elevated)' }}
                title={s.title}
              >
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt={s.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px]" style={{ color: 'var(--text-dim)' }}>
                    -
                  </div>
                )}
              </a>
            ))}
          </div>
          {total !== null && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {total.toLocaleString()} {total === 1 ? 'item' : 'items'} saved
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Mini watchlist card ──────────────────────────────────────────────────────

function MiniWatchlistCard() {
  const [items, setItems] = useState<Watchlist[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((d) => {
        setItems((d.watchlist ?? []).slice(0, 3));
        setTotal(d.total ?? d.watchlist?.length ?? 0);
      })
      .catch(() => {});
  }, []);

  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$',
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Watching</h2>
        <Link
          href="/watchlist"
          className="text-xs hover:underline underline-offset-2"
          style={{ color: 'var(--text-muted)' }}
        >
          View all
        </Link>
      </div>

      {items.length === 0 && total === null ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          Use the eye icon on any listing to track its price.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((w) => {
              const symbol = CURRENCY_SYMBOLS[w.currency] ?? w.currency + ' ';
              const price = w.price_current ?? w.price_at_add;
              return (
                <li key={w.id}>
                  <a
                    href={w.listing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg p-1.5 transition-opacity hover:opacity-80"
                  >
                    <div
                      className="h-9 w-9 shrink-0 overflow-hidden rounded-lg"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      {w.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.image_url} alt={w.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]" style={{ color: 'var(--text)' }}>{w.title}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                        {price !== null ? `${symbol}${price.toLocaleString()}` : 'Price unavailable'}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          {total !== null && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {total.toLocaleString()} {total === 1 ? 'item' : 'items'} watched
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ProfileDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/profile/stats')
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <StatsStrip stats={stats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentSearches />
        </div>
        <TopPlatforms stats={stats} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MiniSavesCard />
        <MiniWatchlistCard />
      </div>
    </div>
  );
}
