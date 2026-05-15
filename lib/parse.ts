import { nanoid } from 'nanoid';
import { Listing } from './types';
import { RawSearchResult, ScrapedListing } from './firecrawl';

// ── URL filtering ──────────────────────────────────────────────────────────
// Only keep URLs that look like individual listing pages, not browse/category pages.

const LISTING_URL_PATTERNS: Record<string, RegExp> = {
  grailed: /grailed\.com\/listings\//,
  depop: /depop\.com\/products\//,
  // Single slug after stockx.com — excludes /sneakers, /mens/shoes, /news/..., etc.
  stockx: /^https?:\/\/(?:www\.)?stockx\.com\/[a-z0-9][a-z0-9-]+[a-z0-9](?:\?[^/]*)?$/i,
  vestiaire: /vestiaire\.com\/.*\d{5,}/,
  vinted: /vinted\.com\/items\/\d+/,
  mercari: /mercari\.com\/us\/item\//,  
  poshmark: /poshmark\.com\/listing\//,
  ebay: /ebay\.com\/itm\//,};

export function filterListingUrls(
  results: RawSearchResult[],
  platform: string
): RawSearchResult[] {
  const pattern = LISTING_URL_PATTERNS[platform];
  if (!pattern) return results;
  return results.filter((r) => pattern.test(r.url));
}

// ── Parse scraped listing data into Listing objects ────────────────────────

export function parseScrapedListings(
  scraped: ScrapedListing[],
  platform: string
): Listing[] {
  return scraped
    .filter((s) => !s.isSold)
    .filter((s) => s.title !== null || s.price !== null)
    .map((s) => ({
      id: nanoid(),
      title: s.title ?? s.url,
      price: s.price,
      currency: s.currency,
      condition: s.condition,
      seller: null,
      url: s.url,
      image: s.imageUrl,
      platform,
    }));
}

// ── Legacy regex-based parser (kept as reference) ──────────────────────────

const PRICE_REGEX = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/;

const CONDITION_MAP: Array<{ keywords: string[]; display: string }> = [
  { keywords: ['deadstock', 'dead stock'], display: 'Deadstock' },
  { keywords: ['new with tags', 'nwt', 'brand new'], display: 'New with Tags' },
  { keywords: ['like new', 'like-new'], display: 'Like New' },
  { keywords: ['lightly used', 'lightly worn'], display: 'Lightly Used' },
  { keywords: ['good condition', 'good'], display: 'Good' },
  { keywords: ['used', 'pre-owned', 'preowned', 'pre owned'], display: 'Used' },
  { keywords: ['fair', 'worn'], display: 'Fair' },
  { keywords: [' ds ', '|ds|', '(ds)', '[ds]', ' ds|', '|ds '], display: 'Deadstock' },
];

function extractPrice(text: string): number | null {
  const match = PRICE_REGEX.exec(text);
  if (!match) return null;
  const numeric = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(numeric) || numeric === 0 ? null : numeric;
}

function extractCondition(text: string): string | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const { keywords, display } of CONDITION_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return display;
  }
  return null;
}

export function parseListings(
  results: RawSearchResult[],
  platform: string
): Listing[] {
  return results
    .filter((r) => r.url && (r.title || r.description))
    .map((r) => {
      const searchText = `${r.title ?? ''} ${r.description ?? ''}`;
      return {
        id: nanoid(),
        title: r.title ?? r.url,
        price: extractPrice(searchText),
        currency: 'USD',
        condition: extractCondition(searchText),
        seller: null,
        url: r.url,
        image: null,
        platform,
      };
    });
}
