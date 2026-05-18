'use client';

import { useEffect, useMemo, useState } from 'react';
import { SearchResponse, PLATFORM_NAMES, Listing } from '@/lib/types';
import ListingCard from './ListingCard';
import PriceSummary, { pickPriceSources } from './PriceSummary';
import { useSaves } from './SavesProvider';

interface Props {
  data: SearchResponse;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export default function ResultsDisplay({ data, minPrice, maxPrice }: Props) {
  const { results, priceRange: dataPriceRange, averagePrice } = data;

  const platformKeys = Object.keys(results);
  const tabs = ['all', ...platformKeys];

  const [activeTab, setActiveTab] = useState('all');
  const { hydrateUrls } = useSaves();

  useEffect(() => {
    const urls = platformKeys.flatMap((p) => results[p].listings.map((l) => l.url));
    if (urls.length > 0) hydrateUrls(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

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
    () => pickPriceSources(results, dataPriceRange),
    [results, dataPriceRange]
  );

  const visibleListings: Listing[] = useMemo(() => {
    const raw =
      activeTab === 'all'
        ? platformKeys.flatMap((p) => results[p].listings)
        : (results[activeTab]?.listings ?? []);
    // Filter by price range (USD only).
    const filtered = raw.filter((listing) => {
      if (listing.price === null || listing.currency !== 'USD') return true;
      if (minPrice != null && listing.price < minPrice) return false;
      if (maxPrice != null && listing.price > maxPrice) return false;
      return true;
    });
    // Sort: USD listings with prices first (ascending), then everything else.
    return [...filtered].sort((a, b) => {
      const aValid = a.price !== null && a.currency === 'USD';
      const bValid = b.price !== null && b.currency === 'USD';
      if (aValid && bValid) return (a.price as number) - (b.price as number);
      if (aValid) return -1;
      if (bValid) return 1;
      return 0;
    });
  }, [activeTab, platformKeys, results, minPrice, maxPrice]);

  const tabLabel = (tab: string) => {
    if (tab === 'all') return `All (${totalCount})`;
    const count = results[tab]?.count ?? 0;
    return `${PLATFORM_NAMES[tab] ?? tab} (${count})`;
  };

  return (
    <div className="space-y-6">
      <PriceSummary
        priceRange={dataPriceRange}
        averagePrice={averagePrice}
        totalCount={totalCount}
        lowSource={lowSource ? (PLATFORM_NAMES[lowSource] ?? lowSource) : null}
        highSource={highSource ? (PLATFORM_NAMES[highSource] ?? highSource) : null}
      />

      <div
        className="hide-scrollbar flex gap-1 overflow-x-auto"
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
