'use client';

import { useState } from 'react';
import { Listing } from '@/lib/types';
import PlatformBadge from './PlatformBadge';
import { useSaves } from './SavesProvider';
import { useWatchlist } from './WatchlistProvider';
import { useAuth } from '@/lib/hooks/useAuth';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', JPY: '¥',
};

function formatPrice(price: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface Props {
  listing: Listing;
  isLowest?: boolean;
}

export default function ListingCard({ listing, isLowest }: Props) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const isNonUsd = listing.currency && listing.currency !== 'USD';

  const { user } = useAuth();
  const { isSaved, toggleSave } = useSaves();
  const { isWatched, toggleWatch } = useWatchlist();
  const saved = isSaved(listing.url);
  const watched = isWatched(listing.url);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSave(listing);
  };

  const handleEyeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatch(listing);
  };

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col overflow-hidden rounded-2xl transition-all cursor-pointer hover:opacity-90 hover:scale-[1.02]"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {listing.image && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image}
            alt={listing.title}
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

        {isLowest && (
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: 'var(--success)', color: '#FFFFFF' }}
          >
            Lowest price
          </span>
        )}

        {user && (
          <button
            type="button"
            onClick={handleHeartClick}
            aria-label={saved ? 'Remove from saves' : 'Add to saves'}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full transition-all"
            style={{
              background: 'rgba(0, 0, 0, 0.55)',
              opacity: saved || hovered ? 1 : 0,
              transform: saved ? 'scale(1)' : 'scale(0.95)',
            }}
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
        )}

        {user && (
          <button
            type="button"
            onClick={handleEyeClick}
            aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            className="absolute flex h-9 w-9 items-center justify-center rounded-full transition-all"
            style={{
              right: '0.5rem',
              top: '3rem',
              background: 'rgba(0, 0, 0, 0.55)',
              opacity: watched || hovered ? 1 : 0,
              transform: watched ? 'scale(1)' : 'scale(0.95)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={watched ? 'var(--accent)' : '#ffffff'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" fill={watched ? 'var(--accent)' : 'none'} />
            </svg>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <PlatformBadge platform={listing.platform} className="self-start" />

        <p
          className="line-clamp-2 text-[13px] leading-snug"
          style={{ color: 'var(--text)' }}
        >
          {listing.title}
        </p>

        <div className="mt-auto flex items-baseline gap-2 pt-1">
          {listing.price !== null ? (
            <>
              <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                {formatPrice(listing.price, listing.currency)}
              </span>
              {isNonUsd && (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
                >
                  {listing.currency}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs italic" style={{ color: 'var(--text-dim)' }}>
              Price unavailable
            </span>
          )}
        </div>

        {listing.condition && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {listing.condition}
          </p>
        )}
      </div>
    </a>
  );
}
