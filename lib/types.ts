// thredup and vestiaire temporarily disabled (commented out, not deleted) —
// see HANDOFF.md for the date/reason. Re-enable by uncommenting both entries
// here (and in NATIVE_PLATFORMS below for thredup) — all downstream lists
// (FilterPanel, settings page, /api/search validation, alerts) derive from
// these two maps via Object.keys(), so nothing else needs to change.
export const PLATFORM_DOMAINS: Record<string, string> = {
  grailed: 'grailed.com',
  depop: 'depop.com',
  poshmark: 'poshmark.com',
  mercari: 'mercari.com',
  vinted: 'vinted.com',
  // thredup: 'thredup.com',
  ebay: 'ebay.com',
  // vestiaire: 'vestiairecollective.com',
  stockx: 'stockx.com',
};

export const PLATFORM_NAMES: Record<string, string> = {
  grailed: 'Grailed',
  depop: 'Depop',
  poshmark: 'Poshmark',
  mercari: 'Mercari',
  vinted: 'Vinted',
  // thredup: 'ThredUp',
  ebay: 'eBay',
  // vestiaire: 'Vestiaire Collective',
  stockx: 'StockX',
};

// Platforms whose listings we extract directly from the platform's own search
// page (one render → full grid) rather than via Brave/Firecrawl URL discovery
// + per-listing fan-out. These scale with the user's tier `nativeResultsCap`
// (10 / 30 / 60 for free / pro / max); non-native platforms are always capped
// at 10 per search regardless of tier.
//
// MUST stay in sync with SEARCH_PAGE_PLATFORMS in:
//   - lib/scraper.ts (re-exports from here)
//   - crawl4ai-service/search_page_extractors.py (Python side)
export const NATIVE_PLATFORMS = new Set<string>([
  'grailed', 'depop', 'mercari', /* thredup, realreal, */
]);

export function isNativePlatform(platform: string): boolean {
  return NATIVE_PLATFORMS.has(platform);
}

export interface Listing {
  id: string;
  title: string;
  price: number | null;
  currency: string; // 'USD', 'GBP', 'EUR', etc.
  condition: string | null;
  size: string | null;
  color: string | null;
  seller: string | null;
  url: string;
  image: string | null;
  platform: string;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Save {
  id: string;
  user_id: string;
  listing_url: string;
  platform: string;
  title: string;
  price: number | null;
  currency: string;
  condition: string | null;
  image_url: string | null;
  seller: string | null;
  saved_at: string;
  folder_id: string | null;
}

export interface CollectionFolder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  item_count?: number;
}

export interface Watchlist {
  id: string;
  user_id: string;
  listing_url: string;
  platform: string;
  title: string;
  price_at_add: number | null;
  price_current: number | null;
  currency: string;
  image_url: string | null;
  is_sold: boolean;
  last_checked_at: string | null;
  created_at: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  platforms: string[];
  filters: {
    color: string | null;
    category: string | null;
    condition: string | null;
    size: string | null;
    minPrice: number | null;
    maxPrice: number | null;
  };
  searched_at: string;
}

export interface PlatformResults {
  listings: Listing[];
  count: number;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  results: Record<string, PlatformResults>;
  priceRange: { min: number; max: number } | null;
  averagePrice: number | null;
}

export interface SearchRequest {
  query: string;
  platforms: string[];
}

export type PlatformKey = keyof typeof PLATFORM_DOMAINS;

export type SearchStreamEvent =
  | { type: 'start'; query: string; platforms: string[]; nativeResultsCap: number }
  | {
      type: 'platform_done';
      platform: string;
      status: 'ok' | 'failed';
      listings: Listing[];
      count: number;
      error?: string;
    }
  | {
      type: 'final';
      priceRange: { min: number; max: number } | null;
      averagePrice: number | null;
    };
