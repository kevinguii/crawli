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
  // Single slug after stockx.com, excludes /sneakers, /mens/shoes, /news/..., etc.
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
  // clothing item types, too generic on a fashion resale platform to distinguish
  // one brand/query from another. A query like "bape t shirt" → tokens {"bape"},
  // so generic-only queries ("t shirt", "basketball shorts") → empty tokens → all pass.
  'shirt', 'tshirt', 'tee', 'hoodie', 'hoody', 'sweatshirt', 'crewneck',
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
// tokens, e.g. "nike", "jordan", and "supreme" all rank in the top ~10k
// English words). Forced to count as anchor tokens regardless of corpus
// frequency. Keep this list narrow and brand-only: it exists to patch a
// specific blind spot in the frequency heuristic, not to be a general brand
// database.
const BRAND_ANCHOR_OVERRIDES = new Set([
  'nike', 'adidas', 'jordan', 'supreme', 'champion', 'guess', 'polo',
  'diesel', 'palace', 'essentials', 'gap', 'express', 'balance', 'acne',
  'omega', 'casio', 'tiffany', 'shock',
  // Two-word (or more) brand phrases where BOTH/ALL halves are ordinary
  // English words on their own (unlike e.g. "carhartt"/"vuitton"). Adding
  // only one half still lets an unrelated brand through if it happens to
  // share that one word (e.g. anchoring only "lauren" would match "LC Lauren
  // Conrad" listings on a "ralph lauren" query, or only "island" would match
  // "Rhode Island" on a "stone island" query). Requiring every half costs
  // nothing against true positives (a genuine listing for the brand
  // contains all the words anyway), and closes that collision. 2026-08-22
  // deep-dive audit across luxury/hypebeast/athletic/heritage-denim/mall/
  // outdoor/watch brands (see PITFALLS "Relevance filtering").
  'ralph', 'lauren', 'north', 'face',
  'chrome', 'hearts', 'fear', 'anti', 'social', 'club', 'represent',
  'stone', 'island', 'under', 'armour', 'armor', 'lee', 'calvin', 'klein',
  'american', 'eagle', 'banana', 'republic', 'free', 'people',
]);

// Exported for lib/soldComps, which needs the same anchoring rules but must NOT
// go through parseScrapedListings (that path drops isSold listings, see below).
export function relevanceTokens(text: string): Set<string> {
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
//      the title must contain at least one of them: "jordan 4" must not
//      slip through a "jordan 1" search.
//   2. Text tokens are split into "anchors" (specific/identifying terms,
//      not in the common-English-word corpus, e.g. "messi", "carhartt") and
//      "soft" tokens (ordinary English words left over from the stopword
//      pass, e.g. "soccer", "running"). If the query has any anchors, the
//      title must contain ALL of them: this is what stops a "messi jersey"
//      search from matching a Ronaldo jersey just because both titles say
//      "soccer jersey". Soft tokens are not required once anchors are
//      satisfied. If the query has no anchors at all (all-generic query),
//      fall back to "match at least one" so we don't reject everything.
// If the query has no substantive tokens at all we pass everything through.
// Query words shoppers type as one word but resale sellers virtually always
// split into two in listing titles, same tokenization gap that made "tshirt"
// an unmatchable anchor before it was stopworded (see PITFALLS.md). Unlike
// "tshirt"/"shirt", sleeve length is a real narrowing signal (a long sleeve
// jersey isn't a short sleeve one), so it's normalized to match instead of
// dropped as a stopword, checked as a substring against the title, same
// mechanism as multi-word brand aliases below.
const COMPOUND_ANCHOR_FORMS: Record<string, string> = {
  longsleeve: 'long sleeve',
  shortsleeve: 'short sleeve',
};

// Numbers a listing title uses for something that is not a model number.
//
// Rule 1 below rejects a title that doesn't contain one of the query's numeric
// tokens, so that "jordan 4" can't satisfy a "jordan 1" search. That rule
// silently assumed every number in a title is a model number. On platforms
// whose grid titles are synthesized from structured attributes rather than
// written by the seller, the only number present is the garment size, and the
// rule then compares a model number against a size: wrong in both directions:
//
//   false negative: ThredUp writes "Levi's Blue Jeans Size 36 waist" and
//     never writes "501" at all, so `levis 501 jeans` matched 0 of 100 rows
//     (measured 2026-08-25) even though ThredUp's own search had just ranked
//     those rows for exactly that query.
//   false positive: a title reading "Jordan Retro Size 1" would satisfy a
//     "jordan 1" search on the strength of its size tag.
//
// So: pull the non-model numbers out, and apply rule 1 only against what's
// left. When nothing is left, the title carries no model-number evidence
// either way and rule 1 abstains rather than rejecting: the text anchors
// below still have to match, which is what keeps a `levis` query from
// returning the RE/DONE jeans ThredUp mixes into the same grid.
const NON_MODEL_NUMERIC_PATTERNS: RegExp[] = [
  // "Size 36", "size: 8.5", and the range form "Size 26 - 27" (both ends:
  // catching only the first left the second reading as a model number).
  /\bsizes?\b[^a-z0-9]{0,3}(\d+(?:\.\d+)?)(?:\s*[-–—/]\s*(\d+(?:\.\d+)?))?/g,
  /(\d+(?:\.\d+)?)\s*(?:in\b|inch|inches|")/g,   // "35 in x 31 in"
  /(\d+(?:\.\d+)?)\s*(?:waist|inseam|length|regular|reg\b|short\b|long\b|tall\b)/g,
  /\b[wl](\d{2})\b/g,                            // "W32 L34"
  /(\d+)\s*x\s*(\d+)/g,                          // "32x34"
  // Material composition, not a model: ThredUp writes "Levi's 100% Cotton
  // Blue Jeans Size 31 waist", and that bare 100 was otherwise read as the
  // title's model number, which then failed to equal 501 and rejected the row.
  /(\d+(?:\.\d+)?)\s*%/g,                        // "100% Cotton"
];

function nonModelNumerics(title: string): Set<string> {
  const lower = title.toLowerCase();
  const found = new Set<string>();
  for (const re of NON_MODEL_NUMERIC_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      for (const g of m.slice(1)) {
        if (g) found.add(g.replace(/\.0+$/, ''));
      }
    }
  }
  return found;
}

export function titleMatchesQuery(title: string | null, queryTokens: Set<string>): boolean {
  if (queryTokens.size === 0) return true;
  if (!title) return false;
  const titleTokens = relevanceTokens(title);

  const queryNumerics = [...queryTokens].filter((t) => /^\d+$/.test(t));
  const queryText = [...queryTokens].filter((t) => !/^\d+$/.test(t));

  if (queryNumerics.length > 0) {
    const ignorable = nonModelNumerics(title);
    const modelNumerics = [...titleTokens].filter((t) => /^\d+$/.test(t) && !ignorable.has(t));
    // Abstain when the title offers no model-number evidence at all (every
    // number in it is a size); enforce strictly the moment it does.
    if (modelNumerics.length > 0 && !queryNumerics.some((t) => modelNumerics.includes(t))) return false;
  }

  if (queryText.length > 0) {
    const isAnchor = (t: string) => BRAND_ANCHOR_OVERRIDES.has(t) || !COMMON_WORDS.has(t);
    const anchors = queryText.filter(isAnchor);

    // Padded, normalized title text for multi-word alias substring checks.
    const titleNorm = ` ${title.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
    const titleBrand = detectBrandInText(title);

    const anchorSatisfied = (t: string): boolean => {
      if (titleTokens.has(t)) return true;
      const compoundForm = COMPOUND_ANCHOR_FORMS[t];
      if (compoundForm && titleNorm.includes(` ${compoundForm} `)) return true;
      // Possessive brands. A shopper types the collapsed form ("levis",
      // "victorias", "chicos"); the title writes the apostrophe form, which
      // relevanceTokens splits into `levi` + a bare `s` it then drops for
      // being under 3 chars. So the anchor could never be satisfied by the
      // brand's own listings. Measured 2026-08-25 on live Poshmark + ThredUp
      // rows: `victorias secret bra` matched 0 of 20 "Victoria's Secret"
      // titles, `chicos jacket` 6 of 99, `dillards blazer` 0 of 4.
      //
      // Requiring the apostrophe (which normalizes to a standalone ` s `) is
      // what keeps this safe: it matches "Victoria's Secret" but NOT "Victoria
      // Beckham", a different real brand. A bare-stem rule would conflate them.
      // Hence this rather than per-brand ALIAS_GROUPS entries, which would also
      // put retailer names into detectBrandInText and corrupt brand detection.
      if (t.length > 3 && t.endsWith('s') && titleNorm.includes(` ${t.slice(0, -1)} s `)) return true;
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
      // and Mercari/Grailed/Depop's native search-grid path, see colorFilter.ts).
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
