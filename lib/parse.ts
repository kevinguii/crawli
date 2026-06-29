import { nanoid } from 'nanoid';
import { Listing } from './types';
import { RawSearchResult, ScrapedListing } from './firecrawl';
import { COMMON_WORDS } from './data/commonWords';
import { extractColorFromTitle } from './colorFilter';
import {
  expandAliasesSync,
  canonicalBrandOf,
  detectBrandInText,
} from './queryExpansion';

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
  // clothing item types — too generic on a fashion resale platform to distinguish
  // one brand/query from another. A query like "bape t shirt" → tokens {"bape"},
  // so generic-only queries ("t shirt", "basketball shorts") → empty tokens → all pass.
  'shirt', 'tee', 'hoodie', 'hoody', 'sweatshirt', 'crewneck',
  'shorts', 'pants', 'jeans', 'denim', 'leggings',
  'jacket', 'coat', 'blazer', 'vest',
  'sweater', 'cardigan', 'pullover',
  'dress', 'skirt', 'blouse', 'top',
  'sneaker', 'sneakers', 'shoe', 'shoes', 'boot', 'boots', 'sandal', 'sandals',
  'hat', 'beanie', 'sock', 'socks',
  'bag', 'handbag', 'purse', 'backpack', 'tote',
]);

// Well-known resale/streetwear brand names that double as ordinary English
// words (so COMMON_WORDS would otherwise treat them as generic, non-required
// tokens — e.g. "nike", "jordan", and "supreme" all rank in the top ~10k
// English words). Forced to count as anchor tokens regardless of corpus
// frequency. Keep this list narrow and brand-only — it exists to patch a
// specific blind spot in the frequency heuristic, not to be a general brand
// database.
const BRAND_ANCHOR_OVERRIDES = new Set([
  'nike', 'adidas', 'jordan', 'supreme', 'champion', 'guess', 'polo',
  'diesel', 'palace', 'essentials', 'gap', 'express', 'balance',
]);

function relevanceTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      // Keep numeric tokens of any length (model numbers: "1", "4", "350", "90")
      // and regular text tokens of 3+ chars. Drop pure stopwords.
      .filter((t) => (t.length >= 3 || /^\d+$/.test(t)) && !RELEVANCE_STOPWORDS.has(t))
  );
}

// Returns true if the scraped title is relevant to the query.
// Rules:
//   1. If the query has numeric tokens (model numbers like "1", "350"),
//      the title must contain at least one of them — "jordan 4" must not
//      slip through a "jordan 1" search.
//   2. Text tokens are split into "anchors" (specific/identifying terms —
//      not in the common-English-word corpus, e.g. "messi", "carhartt") and
//      "soft" tokens (ordinary English words left over from the stopword
//      pass, e.g. "soccer", "running"). If the query has any anchors, the
//      title must contain ALL of them — this is what stops a "messi jersey"
//      search from matching a Ronaldo jersey just because both titles say
//      "soccer jersey". Soft tokens are not required once anchors are
//      satisfied. If the query has no anchors at all (all-generic query),
//      fall back to "match at least one" so we don't reject everything.
// If the query has no substantive tokens at all we pass everything through.
function titleMatchesQuery(title: string | null, queryTokens: Set<string>): boolean {
  if (queryTokens.size === 0) return true;
  if (!title) return false;
  const titleTokens = relevanceTokens(title);

  const queryNumerics = [...queryTokens].filter((t) => /^\d+$/.test(t));
  const queryText = [...queryTokens].filter((t) => !/^\d+$/.test(t));

  if (queryNumerics.length > 0 && !queryNumerics.some((t) => titleTokens.has(t))) return false;

  if (queryText.length > 0) {
    const isAnchor = (t: string) => BRAND_ANCHOR_OVERRIDES.has(t) || !COMMON_WORDS.has(t);
    const anchors = queryText.filter(isAnchor);

    // Padded, normalized title text for multi-word alias substring checks.
    const titleNorm = ` ${title.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
    const titleBrand = detectBrandInText(title);

    const anchorSatisfied = (t: string): boolean => {
      if (titleTokens.has(t)) return true;
      // Brand-to-brand: query token and title resolve to the same canonical brand.
      const canon = canonicalBrandOf(t);
      if (canon && titleBrand === canon) return true;
      // Alias surface forms: single-word aliases match title tokens; multi-word
      // aliases (e.g. "a bathing ape") match as a normalized substring.
      for (const alias of expandAliasesSync(t)) {
        if (alias.includes(' ')) {
          if (titleNorm.includes(` ${alias} `)) return true;
        } else if (titleTokens.has(alias)) {
          return true;
        }
      }
      return false;
    };

    if (anchors.length > 0) {
      if (!anchors.every(anchorSatisfied)) return false;
    } else if (!queryText.some((t) => titleTokens.has(t))) {
      return false;
    }
  }

  return true;
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
      size: s.size ?? null,
      // Structured color (JSON-LD) first; fall back to scanning the title
      // when the platform doesn't expose it at all (Depop/Grailed per-listing,
      // and Mercari/Grailed/Depop's native search-grid path — see colorFilter.ts).
      color: s.color ?? extractColorFromTitle(s.title),
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
        size: null,
        color: null,
        seller: null,
        url: r.url,
        image: null,
        platform,
      };
    });
}
