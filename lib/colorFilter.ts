import { COLOR_OPTIONS } from './filterOptions';

// Brand/color collision post-filter.
//
// "Off-White" is a streetwear brand whose name collides with the color "white".
// When a user ticks the White color swatch, the word `white` gets appended to
// the upstream query and platforms' fuzzy text search returns Off-White brand
// listings as if they were white-colored items. We post-filter those out.
//
// Exception: if the user's typed query itself mentions off-white, they clearly
// want the brand, so the filter is skipped even when color=white is selected.

const OFF_WHITE_RE = /off[-\s]?white/i;

export function queryMentionsOffWhite(query: string | null | undefined): boolean {
  if (!query) return false;
  return OFF_WHITE_RE.test(query);
}

/**
 * Returns true if this listing should be kept under the current color filter.
 * No-op (returns true) for any color other than 'white', or when the user's
 * query already mentions off-white.
 */
export function matchListingColor(
  title: string | null | undefined,
  colorKey: string | null | undefined,
  query: string | null | undefined,
): boolean {
  if (colorKey !== 'white') return true;
  if (queryMentionsOffWhite(query)) return true;
  if (!title) return true;
  return !OFF_WHITE_RE.test(title);
}

// ── Structured-color boost sort ──────────────────────────────────────────
//
// Maps common color/colorway words, including resale-specific colorway
// slang seen in real listings (e.g. streetwear brands naming their own
// shades), to one of our COLOR_OPTIONS keys. Verified live 2026-06-21:
// Poshmark's structured "color" field normalizes "Coral" -> "Orange";
// "Oatmeal" and "Limo" are real Fear of God Essentials colorway names
// observed in live Mercari/Depop listing titles. Lowercase, single-word
// keys only, checked per-token, not substring, to avoid false matches.
const COLOR_SYNONYMS: Record<string, string> = {
  black: 'black', jet: 'black', onyx: 'black', tar: 'black', limo: 'black', ink: 'black',
  white: 'white', ivory: 'white', cream: 'white',
  gray: 'gray', grey: 'gray', charcoal: 'gray', heather: 'gray',
  red: 'red', maroon: 'red', burgundy: 'red', crimson: 'red',
  orange: 'orange', coral: 'orange', rust: 'orange',
  yellow: 'yellow', mustard: 'yellow',
  green: 'green', olive: 'green', sage: 'green', forest: 'green',
  blue: 'blue', navy: 'blue', denim: 'blue', indigo: 'blue', cobalt: 'blue',
  purple: 'purple', lavender: 'purple', violet: 'purple', plum: 'purple',
  pink: 'pink', fuchsia: 'pink', magenta: 'pink', rose: 'pink',
  brown: 'brown', chocolate: 'brown', espresso: 'brown', mocha: 'brown',
  beige: 'beige', tan: 'beige', khaki: 'beige', oatmeal: 'beige', sand: 'beige', stone: 'beige', camel: 'beige',
  gold: 'gold',
  silver: 'silver',
};

const VALID_COLOR_KEYS = new Set(COLOR_OPTIONS.map((c) => c.key));

/**
 * Resolves a raw structured-data color string (e.g. "Dark Oatmeal", "Coral")
 * into one of our COLOR_OPTIONS keys, or null if nothing matches. Multi-word
 * values are tokenized and checked word-by-word (first match wins) since
 * platforms often prefix shade modifiers ("Dark", "Light").
 */
export function resolveColorKey(rawColor: string | null | undefined): string | null {
  if (!rawColor) return null;
  const tokens = rawColor.toLowerCase().replace(/[^a-z\s]+/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (VALID_COLOR_KEYS.has(token)) return token;
    if (COLOR_SYNONYMS[token]) return COLOR_SYNONYMS[token];
  }
  return null;
}

/**
 * Title-text color fallback: used only when a listing has no structured
 * `color` field at all (verified live 2026-06-21: Depop and Grailed's
 * per-listing JSON-LD never carries color, and Mercari/Grailed/Depop's
 * native search-grid path has no structured color signal whatsoever: DOM
 * cards only, no JSON-LD). Lower-trust than structured data since free text
 * can contain a color word for an unrelated reason, so two narrow guards:
 *   - "denim" is skipped: usually describes fabric, not reliably a blue
 *     garment (kept in COLOR_SYNONYMS for structured data, where a
 *     platform's own color attribute literally saying "Denim" is trustworthy).
 *   - "stone" is skipped when followed by "island": Stone Island is a real
 *     brand, same collision pattern as the existing Off-White guard above.
 */
export function extractColorFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const tokens = title.toLowerCase().replace(/[^a-z\s]+/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'denim') continue;
    if (token === 'stone' && tokens[i + 1] === 'island') continue;
    if (VALID_COLOR_KEYS.has(token)) return token;
    if (COLOR_SYNONYMS[token]) return COLOR_SYNONYMS[token];
  }
  return null;
}

/**
 * Boost-only sort: listings whose resolved structured color matches the
 * active color filter move first; everything else (including listings with
 * no structured color data at all) keeps its existing relative order.
 * Never drops a listing: color stays deliberately permissive per the
 * 2026-05-20 design decision (HANDOFF §7 J/K): structured data is real
 * signal where we have it, but incomplete coverage shouldn't cost a user
 * a listing they'd otherwise have seen.
 */
export function sortByColorMatch<T extends { color: string | null }>(
  listings: T[],
  colorKey: string | null | undefined,
): T[] {
  if (!colorKey) return listings;
  return listings
    .map((listing, index) => ({ listing, index, matches: resolveColorKey(listing.color) === colorKey }))
    .sort((a, b) => (a.matches !== b.matches ? (a.matches ? -1 : 1) : a.index - b.index))
    .map((x) => x.listing);
}
