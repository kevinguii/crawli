'use client';

import { useMemo, useState } from 'react';
import { SearchResponse, PLATFORM_NAMES, Listing } from '@/lib/types';
import ListingCard from './ListingCard';
import PriceSummary, { pickPriceSources } from './PriceSummary';

interface Props {
  data: SearchResponse;
}

export default function ResultsDisplay({ data }: Props) {
  const { results, priceRange, averagePrice } = data;

  const platformKeys = Object.keys(results);
  const tabs = ['all', ...platformKeys];

  const [activeTab, setActiveTab] = useState('all');

  const totalCount = platformKeys.reduce((sum, p) => sum + results[p].count, 0);

  const cheapestId = useMemo(() => {
    let min: { id: string; price: number } | null = null;
    for (const p of platformKeys) {
      for (const l of results[p].listings) {
        if (l.price === null || l.currency !== 'USD') continue;
        if (!min || l.price < min.price) min = { id: l.id, price: l.price };
      }
    }
    return min?.id ?? null;
  }, [results, platformKeys]);

  const { lowSource, highSource } = useMemo(
    () => pickPriceSources(results, priceRange),
    [results, priceRange]
  );

  const visibleListings: Listing[] =
    activeTab === 'all'
      ? platformKeys.flatMap((p) => results[p].listings)
      : (results[activeTab]?.listings ?? []);

  const tabLabel = (tab: string) => {
    if (tab === 'all') return `All (${totalCount})`;
    const count = results[tab]?.count ?? 0;
    return `${PLATFORM_NAMES[tab] ?? tab} (${count})`;
  };

  return (
    <div className="space-y-6">
      <PriceSummary
        priceRange={priceRange}
        averagePrice={averagePrice}
        totalCount={totalCount}
        lowSource={lowSource ? (PLATFORM_NAMES[lowSource] ?? lowSource) : null}
        highSource={highSource ? (PLATFORM_NAMES[highSource] ?? highSource) : null}
      />

      <div
        className="flex gap-1 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                color: active ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              {tabLabel(tab)}
              <span
                className="pointer-events-none absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-opacity"
                style={{
                  background: 'var(--accent)',
                  opacity: active ? 1 : 0,
                }}
              />
            </button>
          );
        })}
      </div>

      {visibleListings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isLowest={listing.id === cheapestId}
            />
          ))}
        </div>
      ) : (
        <div
          className="rounded-2xl py-16 text-center text-sm"
          style={{
            border: '1px dashed var(--border)',
            color: 'var(--text-dim)',
          }}
        >
          {activeTab === 'all'
            ? 'No listings found — try a different search.'
            : `No listings found on ${PLATFORM_NAMES[activeTab] ?? activeTab}.`}
        </div>
      )}
    </div>
  );
}
