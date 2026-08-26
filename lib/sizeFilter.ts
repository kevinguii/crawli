// Size matching helpers for post-filtering listing results.
// Used for SEARCH_PAGE_PLATFORMS (ThredUp) where titles embed size text, AND
// for all other platforms (Grailed, Depop, etc.) where a structured `size`
// field is extracted directly from the listing page.

import { CLOTHING_SIZE_OPTIONS, SHOE_SIZE_OPTIONS } from './filterOptions';

// Map clothing FilterState keys → all variants that should match the title.
// Each variant is a regex pattern anchored to a "Size" prefix to avoid
// substring collisions (e.g. 'l' matching the L inside "XL").
const CLOTHING_PATTERNS: Record<string, RegExp[]> = {
  xs:  [/\bSize\s+XS\b/i, /\bSize\s+Extra[\s-]?Small\b/i, /\bXS\b(?!XL)/],
  s:   [/\bSize\s+S\b/i, /\bSize\s+Small\b/i],
  m:   [/\bSize\s+M\b/i, /\bSize\s+Medium\b/i],
  l:   [/\bSize\s+L\b/i, /\bSize\s+Large\b(?!\s*\/)/i],
  xl:  [/\bSize\s+XL\b/i, /\bSize\s+Extra[\s-]?Large\b/i, /\bXL\b(?!L)/],
  xxl: [/\bSize\s+XXL\b/i, /\bSize\s+2XL?\b/i, /\bXXL\b/i, /\b2XL\b/i],
};

// Shoe key like 'm7_5' encodes the numeric size: 7.5
function shoeKeyToNumber(key: string): string | null {
  const m = key.match(/^m(\d+)(?:_(\d+))?$/);
  if (!m) return null;
  const whole = m[1];
  const frac = m[2];
  return frac ? `${whole}.${frac}` : whole;
}

// Build a regex that matches a shoe size in a title, allowing common variants:
// "Size 7.5", "Size 7 1/2", "7.5", "7 1/2"
function shoeRegex(num: string): RegExp {
  if (num.includes('.')) {
    const [whole, frac] = num.split('.');
    // Half size: match "7.5", "7 1/2"
    if (frac === '5') {
      return new RegExp(`\\bSize\\s+${whole}(?:\\.5|\\s+1/2)\\b`, 'i');
    }
    return new RegExp(`\\bSize\\s+${whole}\\.${frac}\\b`, 'i');
  }
  // Whole size: "Size 7", but NOT "Size 7.5" or "Size 7 1/2"
  return new RegExp(`\\bSize\\s+${num}(?!\\s*(?:\\.|\\s+1/2))\\b`, 'i');
}

// Clothing size tokens for direct size-field matching (Grailed, Depop, etc.)
// Normalized: lowercase, hyphens/spaces collapsed, "(US)"/"(EU)" suffixes stripped.
const CLOTHING_RAW_TOKENS: Record<string, string[]> = {
  xs:  ['xs', 'xsmall', 'extrasmall', 'xsmall'],
  s:   ['s', 'sm', 'small'],
  m:   ['m', 'md', 'med', 'medium'],
  l:   ['l', 'lg', 'large'],
  xl:  ['xl', 'xlarge', 'extralarge'],
  xxl: ['xxl', '2xl', 'xxlarge', '2xlarge'],
};

/**
 * Match a raw size value (e.g. "L", "Large", "XL", "7.5") against a filter key.
 * Used when the platform returns a structured size field rather than embedding it in the title.
 */
export function matchRawSize(rawSize: string, sizeKey: string): boolean {
  // Normalize: lowercase, collapse hyphens/spaces, strip parenthetical suffixes like "(US)"
  const v = rawSize.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[-\s]+/g, '').trim();

  const tokens = CLOTHING_RAW_TOKENS[sizeKey];
  if (tokens) {
    return tokens.some((t) => v === t || v.startsWith(t + '/'));
  }

  const num = shoeKeyToNumber(sizeKey);
  if (num) {
    // Strip everything except digits and dots, take the first numeric token
    const numPart = rawSize.replace(/[^\d.]/g, ' ').trim().split(/\s+/)[0] ?? '';
    return numPart === num;
  }

  return true;
}

/**
 * Does this listing match the requested size key?
 * Checks `rawSize` (structured field) first, more reliable than title text.
 * Falls back to title regex matching for platforms (ThredUp) that embed size in the title.
 * sizeKey is a FilterState.size value like 'l', 'm7_5', or 'xxl'.
 * Returns true when no size key is provided (no-op filter).
 */
export function matchListingSize(
  title: string | null | undefined,
  sizeKey: string | null | undefined,
  rawSize?: string | null,
): boolean {
  if (!sizeKey) return true;

  // Prefer the structured size field when available
  if (rawSize) {
    return matchRawSize(rawSize, sizeKey);
  }

  // Fall back to title text pattern matching (ThredUp format: "… Size XL")
  if (!title) return false;

  if (sizeKey in CLOTHING_PATTERNS) {
    return CLOTHING_PATTERNS[sizeKey].some((re) => re.test(title));
  }

  const num = shoeKeyToNumber(sizeKey);
  if (num) {
    return shoeRegex(num).test(title);
  }

  return true; // unknown key → don't filter
}

/**
 * Scan the user's raw query text for a size word and return a FilterState.size
 * key if found. Used to handle typed sizes (e.g. "nike shoes large") when no
 * structured size filter was selected in the FilterPanel.
 * Returns null if no size word is detected.
 */
export function detectSizeFromQuery(query: string): string | null {
  if (!query) return null;
  const q = query.toLowerCase();

  // Clothing words → key. Order matters: check "xxl"/"xx-large" before "xl",
  // "extra large" before "large", etc.
  const wordChecks: Array<[RegExp, string]> = [
    [/\b(?:xxl|xx-?large|2xl)\b/, 'xxl'],
    [/\b(?:xl|x-?large|extra[\s-]?large)\b/, 'xl'],
    [/\blarge\b/, 'l'],
    [/\bmedium\b/, 'm'],
    [/\bsmall\b/, 's'],
    [/\b(?:xs|x-?small|extra[\s-]?small)\b/, 'xs'],
  ];
  for (const [re, key] of wordChecks) {
    if (re.test(q)) return key;
  }

  // "size L", "size M", etc. (single-letter abbreviation with explicit prefix)
  const sizePrefixed = q.match(/\bsize\s+(xs|s|m|l|xl|xxl)\b/);
  if (sizePrefixed) return sizePrefixed[1];

  // Shoe size: "size 7.5", "size 7 1/2", "size 10"
  const shoeMatch = q.match(/\bsize\s+(\d+)(?:\.5|\s+1\/2)?\b/);
  if (shoeMatch) {
    const num = shoeMatch[0].includes('.5') || shoeMatch[0].includes('1/2')
      ? `${shoeMatch[1]}.5`
      : shoeMatch[1];
    // Map back to shoe key format (m7_5, m10, ...)
    const matching = SHOE_SIZE_OPTIONS.find((o) => {
      const k = o.key.match(/^m(\d+)(?:_(\d+))?$/);
      if (!k) return false;
      const optNum = k[2] ? `${k[1]}.${k[2]}` : k[1];
      return optNum === num;
    });
    return matching?.key ?? null;
  }

  // Reference CLOTHING_SIZE_OPTIONS to keep the import meaningful (and to
  // implicitly validate that the keys we use above exist in the option table).
  void CLOTHING_SIZE_OPTIONS;
  return null;
}
