export const PLATFORM_DOMAINS: Record<string, string> = {
  grailed: 'grailed.com',
  depop: 'depop.com',
  stockx: 'stockx.com',
  poshmark: 'poshmark.com',
  ebay: 'ebay.com',
  mercari: 'mercari.com',
  vinted: 'vinted.com',
  vestiaire: 'vestiairecollective.com',
};

export const PLATFORM_NAMES: Record<string, string> = {
  grailed: 'Grailed',
  depop: 'Depop',
  stockx: 'StockX',
  poshmark: 'Poshmark',
  ebay: 'eBay',
  mercari: 'Mercari',
  vinted: 'Vinted',
  vestiaire: 'Vestiaire Collective',
};

export interface Listing {
  id: string;
  title: string;
  price: number | null;
  currency: string; // 'USD', 'GBP', 'EUR', etc.
  condition: string | null;
  seller: string | null;
  url: string;
  image: string | null;
  platform: string;
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
  | { type: 'start'; query: string; platforms: string[] }
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
