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
