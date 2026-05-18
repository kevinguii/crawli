'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Save } from '@/lib/types';
import { PLATFORM_NAMES } from '@/lib/types';
import PlatformBadge from '@/app/components/PlatformBadge';
import { useSaves } from '@/app/components/SavesProvider';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', JPY: '¥',
};

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Price unavailable';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function SavesTab() {
  const [saves, setSaves] = useState<Save[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { hydrateUrls } = useSaves();

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
        const res = await fetch(`/api/saves${params.toString() ? `?${params}` : ''}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (cancelled) return;
        const next: Save[] = data.saves ?? [];
        setSaves(next);
        hydrateUrls(next.map((s) => s.listing_url));
      } catch {
        if (!cancelled) toast.error('Could not load saves');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [debouncedSearch, hydrateUrls]);

  const handleRemove = async (save: Save) => {
    const prev = saves;
    setSaves((s) => s.filter((x) => x.id !== save.id));
    try {
      const res = await fetch(`/api/saves/${save.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast('Removed from Favorites', {
        style: { color: '#E24B4A', borderColor: '#E24B4A' },
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ),
      });
    } catch {
      setSaves(prev);
      toast.error('Could not remove. Try again.');
    }
  };

  const empty = useMemo(() => !loading && saves.length === 0, [loading, saves]);

  return (
    <div className="space-y-5">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search saved listings..."
        className="input-base w-full rounded-lg px-4 py-2.5 text-sm"
      />

      {loading && saves.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          Loading saves…
        </div>
      ) : empty ? (
        <div
          className="rounded-2xl py-16 text-center text-sm"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-dim)' }}
        >
          {debouncedSearch
            ? `No saves matching "${debouncedSearch}".`
            : 'No saves yet. Heart listings to save them ❤️'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saves.map((s) => (
            <SaveCard key={s.id} save={s} onRemove={() => handleRemove(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SaveCard({ save, onRemove }: { save: Save; onRemove: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);

  const handleHeart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove();
  };

  return (
    <a
      href={save.listing_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl transition-all hover:opacity-90 hover:scale-[1.02]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {save.image_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={save.image_url}
            alt={save.title}
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
        <button
          type="button"
          onClick={handleHeart}
          aria-label="Remove from saves"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ background: 'rgba(0, 0, 0, 0.55)' }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#E24B4A"
            stroke="#E24B4A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <PlatformBadge platform={save.platform} className="self-start" />
        <p
          className="line-clamp-2 text-[13px] leading-snug"
          style={{ color: 'var(--text)' }}
          title={save.title}
        >
          {save.title}
        </p>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {formatPrice(save.price, save.currency)}
          </span>
          {save.currency && save.currency !== 'USD' && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
            >
              {save.currency}
            </span>
          )}
        </div>
        {save.condition && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {save.condition}
          </p>
        )}
        <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
          {PLATFORM_NAMES[save.platform] ?? save.platform} · saved {new Date(save.saved_at).toLocaleDateString()}
        </p>
      </div>
    </a>
  );
}
