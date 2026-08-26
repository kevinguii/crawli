// Platforms excluded from alerts.
//
// STALE RATIONALE, BEHAVIOUR DELIBERATELY UNCHANGED (2026-08-25): the original
// reason was that eBay ran on the Firecrawl discover-then-scrape-each-listing
// path, intermittent Akamai 403s on per-listing pages plus LLM extraction
// cost, unsuitable for an unattended cron. eBay now renders its own search
// grid natively in one request (see NATIVE_PLATFORMS in lib/types.ts), which
// removes both objections: measured 8/8 success under concurrent load from the
// production datacenter IP, and zero Firecrawl credits on the native path.
// The exclusion is kept only because letting eBay into alerts raises recurring
// cron load, which is a product call rather than a technical one.
// Imported by both server (alertRunner.ts) and client (CreateAlertModal.tsx).
export const ALERT_EXCLUDED_PLATFORMS = new Set(['ebay']);

// Free-tier cooldown between baseline-changing alert edits (query/platforms/
// filters/criteria), per alert. Paid tiers are uncapped. A baseline edit
// re-runs the search in-house (crawl4ai only: every alertable platform is on
// the native path), so the cost is marginal and we rate-limit
// velocity rather than charging a search credit.
export const FREE_BASELINE_EDIT_COOLDOWN_HOURS = 4;

/**
 * Characters that mean "and another thing" to a person writing an alert, but
 * mean nothing to the search engine.
 *
 * `relevanceTokens` (lib/parse.ts) strips all punctuation before tokenizing, and
 * `titleMatchesQuery` then requires a listing title to contain EVERY remaining
 * anchor. So "bape, supreme, jerseys" silently becomes "find one listing that is
 * a Bape AND a Supreme AND a jersey", which can never match. Measured on live
 * data 2026-08-20, 3 of 12 real alerts were dead for exactly this reason, each
 * having run daily for a week with zero results.
 *
 * An alert watches ONE thing. Rather than guessing at what a list meant, the UI
 * simply rejects these characters and asks for plain words: no per-item
 * splitting, no suggested fix, same message for every user.
 *
 * Apostrophes and hyphens are deliberately NOT here: "Levi's" and "wind-breaker"
 * are real product names, and the tokenizer already handles them.
 */
export const ALERT_QUERY_SEPARATORS = [',', ';', '|', '/', '&', '+'] as const;

export interface AlertQueryProblem {
  /** The offending characters, in the order they appear. */
  separators: string[];
}

/**
 * Validate an alert query. Returns null when the query is fine.
 *
 * Deliberately a pure function with no imports so both the client (inline
 * validation in CreateAlertModal) and the server (POST/PATCH guard) can share
 * it and cannot drift apart.
 */
export function findAlertQueryProblem(query: string): AlertQueryProblem | null {
  const separators = ALERT_QUERY_SEPARATORS.filter((sep) => query.includes(sep));
  if (separators.length === 0) return null;
  return { separators };
}
