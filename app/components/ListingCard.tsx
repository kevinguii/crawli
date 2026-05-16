'use client';

import { useState } from 'react';
import { Listing } from '@/lib/types';
import PlatformBadge from './PlatformBadge';

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
