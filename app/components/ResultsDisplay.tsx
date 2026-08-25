'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchResponse, PLATFORM_NAMES, Listing } from '@/lib/types';
import ListingCard from './ListingCard';
import PriceSummary, { pickPriceSources } from './PriceSummary';
import { useSaves } from './SavesProvider';
import { useWatchlist } from './WatchlistProvider';
import { convertToUSD } from '@/lib/currency';
import { useScrollEdges, scrollFadeMask } from '@/lib/hooks/useScrollEdges';
import { pickShareCardListing } from '@/lib/shareCard';
import ShareFindButton from './ShareFindButton';

interface Props {
  data: SearchResponse;
  minPrice?: number | null;
  maxPrice?: number | null;
}

// How many cards to render before the "Show more" reveal.
//
// This is purely a render budget, NOT a fetch or entitlement limit: every listing
// is already in memory by the time this component mounts (the sidecar is called
// with a hardcoded limit=100 per platform and TIER_CAPS.nativeResultsCap slices
// the result server-side), so revealing more costs one setState and no network.
// It exists because the "All" tab flatMaps every platform — at Pro's 100-per-
// platform cap that is up to ~800 image cards in a single grid, which is a real
// first-paint cost for listings almost nobody scrolls to.
const PAGE_SIZE = 48;


export default function ResultsDisplay({ data, minPrice, maxPrice }: Props) {
  const { results, priceRange: dataPriceRange, averagePrice } = data;

  const platformKeys = Object.keys(results);
  const tabs = ['all', ...platformKeys];

  const [activeTab, setActiveTab] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { hydrateUrls } = useSaves();
  const { hydrateUrls: hydrateWatchUrls } = useWatchlist();
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsEdges = useScrollEdges(tabsRef);

  useEffect(() => {
    const urls = platformKeys.flatMap((p) => results[p].listings.map((l) => l.url));
    if (urls.length > 0) {
      hydrateUrls(urls);
      hydrateWatchUrls(urls);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const totalCount = platformKeys.reduce((sum, p) => sum + results[p].count, 0);

  const cheapestId = useMemo(() => {
    let min: { id: string; price: number } | null = null;
    for (const p of platformKeys) {
      for (const l of results[p].listings) {
        if (l.price === null) continue;
        const effective = l.currency === 'USD' ? l.price : (convertToUSD(l.price, l.currency) ?? null);
        if (effective === null) continue;
        if (!min || effective < min.price) min = { id: l.id, price: effective };
      }
    }
    return min?.id ?? null;
  }, [results, platformKeys]);

  const { lowSource, highSource } = useMemo(
    () => pickPriceSources(results, dataPriceRange),
    [results, dataPriceRange]
  );

  // Computed independently of `cheapestId` above: that one drives the on-screen
  // "lowest" badge, this one always spans every platform in the response, so a
  // change to either can never move the other.
  const shareCardData = useMemo(
    () => pickShareCardListing(data.query, results),
    [data.query, results]
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
    // Sort by effective USD price ascending; listings with no convertible price go last.
    const effectiveUSD = (l: Listing): number | null => {
      if (l.price === null) return null;
      return l.currency === 'USD' ? l.price : (convertToUSD(l.price, l.currency) ?? null);
    };
    return [...filtered].sort((a, b) => {
      const aUSD = effectiveUSD(a);
      const bUSD = effectiveUSD(b);
      if (aUSD !== null && bUSD !== null) return aUSD - bUSD;
      if (aUSD !== null) return -1;
      if (bUSD !== null) return 1;
      return 0;
    });
  }, [activeTab, platformKeys, results, minPrice, maxPrice]);

  // Collapse back to the first page whenever the visible set changes underneath
  // us — switching tabs, re-filtering, or a new search should not inherit the
  // previous reveal. Deliberately a render-phase adjustment rather than an
  // effect: setState inside an effect body cascades an extra render (and trips
  // react-hooks/immutability). See "adjusting state when props change" in the
  // React docs.
  const viewKey = `${activeTab}|${minPrice ?? ''}|${maxPrice ?? ''}`;
  const [lastView, setLastView] = useState({ key: viewKey, results });
  if (lastView.key !== viewKey || lastView.results !== results) {
    setLastView({ key: viewKey, results });
    setVisibleCount(PAGE_SIZE);
  }

  const shownListings = visibleListings.slice(0, visibleCount);
  const remainingCount = visibleListings.length - shownListings.length;

  const tabLabel = (tab: string) => {
    if (tab === 'all') return `All (${totalCount})`;
    const count = results[tab]?.count ?? 0;
    const name = PLATFORM_NAMES[tab] ?? tab;
    return `${name} (${count})`;
  };

  return (
    <div className="space-y-6">
      <PriceSummary
        query={data.query}
        priceRange={dataPriceRange}
        averagePrice={averagePrice}
        totalCount={totalCount}
        lowSource={lowSource ? (PLATFORM_NAMES[lowSource] ?? lowSource) : null}
        highSource={highSource ? (PLATFORM_NAMES[highSource] ?? highSource) : null}
      />

      <ShareFindButton data={shareCardData} />

      <div
        ref={tabsRef}
        className="hide-scrollbar flex gap-1 overflow-x-auto"
        style={{
          borderBottom: '1px solid var(--border)',
          WebkitMaskImage: scrollFadeMask(tabsEdges),
          maskImage: scrollFadeMask(tabsEdges),
        }}
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shownListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isLowest={listing.id === cheapestId}
              />
            ))}
          </div>

          {remainingCount > 0 && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                Show {Math.min(remainingCount, PAGE_SIZE)} more
              </button>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Showing {shownListings.length} of {visibleListings.length}
              </span>
            </div>
          )}
        </>
      ) : (
        <div
          className="rounded-2xl py-16 text-center text-sm"
          style={{
            border: '1px dashed var(--border)',
            color: 'var(--text-dim)',
          }}
        >
          {activeTab === 'all'
            ? 'No listings found. Try a different search.'
            : `No listings found on ${PLATFORM_NAMES[activeTab] ?? activeTab}.`}
        </div>
      )}
    </div>
  );
}
