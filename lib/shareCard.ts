import type { Listing, PlatformResults } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';

// 4:5, matching the export spec used for every other Crawli social image.
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

export interface ShareCardData {
  query: string;
  totalCount: number;
  platformCount: number;
  listing: Listing;
}

/** Picks the cheapest listing (by effective USD price) across every platform's
 *  results, plus the total listing count and the number of platforms actually
 *  represented. Returns null when there is nothing priced to feature.
 *
 *  Deliberately a separate computation from ResultsDisplay's `cheapestId`, which
 *  drives the ListingCard "lowest" badge: that one is scoped to what is on screen,
 *  this one always spans every platform in the response. Keeping them apart means
 *  a change here can never move that badge. */
export function pickShareCardListing(
  query: string,
  results: Record<string, PlatformResults>,
): ShareCardData | null {
  const platformKeys = Object.keys(results);
  const totalCount = platformKeys.reduce((sum, p) => sum + results[p].count, 0);
  const platformCount = platformKeys.filter((p) => results[p].count > 0).length;

  let cheapest: { listing: Listing; effectiveUSD: number } | null = null;
  for (const p of platformKeys) {
    for (const listing of results[p].listings) {
      if (listing.price === null) continue;
      const effectiveUSD =
        listing.currency === 'USD' ? listing.price : convertToUSD(listing.price, listing.currency);
      if (effectiveUSD === null) continue;
      if (!cheapest || effectiveUSD < cheapest.effectiveUSD) cheapest = { listing, effectiveUSD };
    }
  }

  if (!cheapest || totalCount === 0) return null;
  return { query, totalCount, platformCount, listing: cheapest.listing };
}

/** Builds the stateless GET url for /api/share-card. All card content travels
 *  as query params, so the route has nothing to look up and nothing to persist. */
export function buildShareCardUrl(data: ShareCardData): string {
  const params = new URLSearchParams({
    query: data.query,
    count: String(data.totalCount),
    platforms: String(data.platformCount),
    price: data.listing.price !== null ? String(data.listing.price) : '',
    currency: data.listing.currency,
    platform: data.listing.platform,
    title: data.listing.title,
    image: data.listing.image ?? '',
  });
  return `/api/share-card?${params.toString()}`;
}
