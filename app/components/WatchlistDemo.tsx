'use client';

import type { Watchlist } from '@/lib/types';
import PlatformBadge from '@/app/components/PlatformBadge';

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

const demoItems: Watchlist[] = [
  {
    id: '1',
    user_id: 'test',
    listing_url: 'https://example.com/1',
    platform: 'poshmark',
    title: 'Fear of God Essentials Hoodie - Price Dropped',
    image_url: 'https://images.unsplash.com/photo-1556821552-5f9f4c2d0c3f?w=400&h=400&fit=crop',
    price_at_add: 145,
    price_current: 89,
    currency: 'USD',
    is_sold: false,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    last_checked_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    user_id: 'test',
    listing_url: 'https://example.com/2',
    platform: 'depop',
    title: 'Vintage Levi\'s 501 - Marked as Sold',
    image_url: 'https://images.unsplash.com/photo-1541099810657-400bc92f0e4c?w=400&h=400&fit=crop',
    price_at_add: 75,
    price_current: 75,
    currency: 'USD',
    is_sold: true,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    last_checked_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    user_id: 'test',
    listing_url: 'https://example.com/3',
    platform: 'vestiaire',
    title: 'Balenciaga City Bag - Price Increased',
    image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop',
    price_at_add: 320,
    price_current: 380,
    currency: 'EUR',
    is_sold: false,
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    last_checked_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    user_id: 'test',
    listing_url: 'https://example.com/4',
    platform: 'grailed',
    title: 'Supreme Box Logo Hoodie - Never Checked',
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    price_at_add: 450,
    price_current: 450,
    currency: 'USD',
    is_sold: false,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    last_checked_at: null,
  },
];

function DemoWatchCard({ row }: { row: Watchlist }) {
  const at = row.price_at_add;
  const cur = row.price_current;
  const hasDelta = at !== null && cur !== null && at !== cur;
  const deltaAbs = hasDelta ? (cur as number) - (at as number) : 0;
  const deltaPct = hasDelta && at ? Math.round((deltaAbs / (at as number)) * 100) : 0;
  const dropped = deltaAbs < 0;
  const symbol = CURRENCY_SYMBOLS[row.currency] ?? row.currency + ' ';

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {row.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.image_url}
            alt={row.title}
            className="h-full w-full object-cover"
          />
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
                Gone
              </span>
            </div>
          </>
        )}
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
          {row.platform} · watching since {new Date(row.created_at).toLocaleDateString()}
          {row.last_checked_at && ` · last refreshed ${relativeTime(row.last_checked_at)}`}
          {!row.last_checked_at && ' · never refreshed'}
        </p>
      </div>
    </div>
  );
}

export default function WatchlistDemo() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold" style={{ color: 'var(--text)' }}>Watchlist UI Examples</h1>
        <p style={{ color: 'var(--text-dim)' }}>Four example states showing different price and sold scenarios:</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {demoItems.map((item) => (
          <div key={item.id}>
            <div className="mb-3 rounded bg-blue-50 p-2 text-xs dark:bg-blue-900">
              <div style={{ color: 'var(--text-dim)' }} className="font-semibold mb-1">
                {item.title.split(' - ')[1]}
              </div>
              <div className="space-y-1 text-[11px]">
                <div>Original: {formatPrice(item.price_at_add, item.currency)}</div>
                <div>Current: {formatPrice(item.price_current, item.currency)}</div>
                {item.is_sold && <div className="font-semibold">Is Sold: ✓</div>}
              </div>
            </div>
            <DemoWatchCard row={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
