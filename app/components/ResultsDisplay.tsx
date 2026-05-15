'use client';

import { useState } from 'react';
import { SearchResponse, PLATFORM_NAMES, Listing } from '@/lib/types';
import ListingCard from './ListingCard';
import PriceSummary from './PriceSummary';

interface Props {
  data: SearchResponse;
}

export default function ResultsDisplay({ data }: Props) {
  const { results, priceRange, averagePrice } = data;

  // Only show tabs for platforms that were searched
  const platformKeys = Object.keys(results);
  const tabs = ['all', ...platformKeys];

  const [activeTab, setActiveTab] = useState('all');

  const totalCount = platformKeys.reduce((sum, p) => sum + results[p].count, 0);

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
    <div className="space-y-4">
      <PriceSummary
        priceRange={priceRange}
        averagePrice={averagePrice}
        totalCount={totalCount}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visibleListings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          {activeTab === 'all'
            ? 'No listings found — try a different search.'
            : `No listings found on ${PLATFORM_NAMES[activeTab] ?? activeTab}.`}
        </div>
      )}
    </div>
  );
}
