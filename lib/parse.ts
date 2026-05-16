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
  vestiaire: /vestiairecollective\.com\/.*\d{5,}/,
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

// Generic words that shouldn't count toward query/title overlap. Colors, sizes,
// conditions, and ultra-common nouns appear in many unrelated listings, so
// matching only on those would let off-topic results through.
const RELEVANCE_STOPWORDS = new Set([
  // articles / prepositions / conjunctions
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'over', 'your',
  // colors
  'black', 'white', 'gray', 'grey', 'red', 'orange', 'yellow', 'green', 'blue',
  'purple', 'pink', 'brown', 'beige', 'gold', 'silver', 'cream', 'tan', 'navy',
  'olive', 'khaki',
  // sizes / size words
  'size', 'sizes', 'xxs', 'small', 'medium', 'large', 'xlarge', 'xxl', 'xxxl',
  // condition / generic descriptors
  'new', 'used', 'mens', 'womens', 'men', 'women', 'kids', 'unisex',
  'authentic', 'genuine', 'rare', 'vintage', 'used',
]);

function relevanceTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !RELEVANCE_STOPWORDS.has(t))
  );
}

// Returns true if the scraped title shares at least one substantive token with
// the original query. If the query has no substantive tokens after stopwording
// (e.g. just "black hoodie size m"), we pass everything through rather than
// drop all results.
function titleMatchesQuery(title: string | null, queryTokens: Set<string>): boolean {
  if (queryTokens.size === 0) return true;
  if (!title) return false;
  const titleTokens = relevanceTokens(title);
  for (const t of queryTokens) {
    if (titleTokens.has(t)) return true;
  }
  return false;
}

export function parseScrapedListings(
  scraped: ScrapedListing[],
  platform: string,
  query?: string
): Listing[] {
  const queryTokens = query ? relevanceTokens(query) : new Set<string>();

  return scraped
    .filter((s) => !s.isSold)
    .filter((s) => s.title !== null || s.price !== null)
    .filter((s) => titleMatchesQuery(s.title, queryTokens))
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
