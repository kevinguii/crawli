'use client';

import { Listing, PLATFORM_NAMES } from '@/lib/types';

const CONDITION_COLORS: Record<string, string> = {
  Deadstock: 'bg-green-100 text-green-800',
  'New with Tags': 'bg-green-100 text-green-800',
  'Like New': 'bg-emerald-100 text-emerald-800',
  'Lightly Used': 'bg-yellow-100 text-yellow-800',
  Good: 'bg-yellow-100 text-yellow-800',
  Used: 'bg-gray-100 text-gray-700',
  Fair: 'bg-gray-100 text-gray-600',
};

const PLATFORM_COLORS: Record<string, string> = {
  grailed: 'bg-red-100 text-red-700',
  depop: 'bg-pink-100 text-pink-700',
  stockx: 'bg-green-100 text-green-700',
  vestiaire: 'bg-purple-100 text-purple-700',
  vinted: 'bg-teal-100 text-teal-700',
  mercari: 'bg-blue-100 text-blue-700',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', JPY: '¥',
};

function formatPrice(price: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface Props {
  listing: Listing;
}

export default function ListingCard({ listing }: Props) {
  const conditionColor = listing.condition
    ? (CONDITION_COLORS[listing.condition] ?? 'bg-gray-100 text-gray-600')
    : null;
  const platformColor =
    PLATFORM_COLORS[listing.platform] ?? 'bg-gray-100 text-gray-600';
  const isNonUsd = listing.currency && listing.currency !== 'USD';

  return (
    <div className="relative flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Platform badge */}
      <span
        className={`absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-medium ${platformColor}`}
      >
        {PLATFORM_NAMES[listing.platform] ?? listing.platform}
      </span>

      {/* Image */}
      {listing.image ? (
        <img
          src={listing.image}
          alt={listing.title}
          className="mb-3 h-40 w-full rounded-lg object-cover bg-gray-100"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="mb-3 h-40 w-full rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
          No image
        </div>
      )}

      {/* Price */}
      <div className="mb-1 flex items-baseline gap-2">
        {listing.price !== null ? (
          <>
            <span className="text-2xl font-bold text-gray-900">
              {formatPrice(listing.price, listing.currency)}
            </span>
            {isNonUsd && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                {listing.currency}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-gray-400 italic">Price unavailable</span>
        )}
      </div>

      {/* Condition badge */}
      {listing.condition && conditionColor && (
        <span
          className={`mb-2 self-start rounded-full px-2 py-0.5 text-xs font-medium ${conditionColor}`}
        >
          {listing.condition}
        </span>
      )}

      {/* Title */}
      <p className="mb-3 text-sm text-gray-700 line-clamp-2 flex-1">
        {listing.title}
      </p>

      {/* View listing link */}
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto block rounded-lg bg-gray-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-gray-700 transition-colors"
      >
        View listing →
      </a>
    </div>
  );
}
