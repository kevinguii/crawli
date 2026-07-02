// Platforms excluded from alerts — eBay has intermittent Akamai blocks
// and LLM extraction cost that makes it unsuitable for scheduled cron runs.
// Imported by both server (alertRunner.ts) and client (CreateAlertModal.tsx).
export const ALERT_EXCLUDED_PLATFORMS = new Set(['ebay']);

// Free-tier cooldown between baseline-changing alert edits (query/platforms/
// filters/criteria), per alert. Paid tiers are uncapped. A baseline edit
// re-runs the search in-house (crawl4ai only — eBay, the sole Firecrawl-metered
// platform, is excluded from alerts), so the cost is marginal and we rate-limit
// velocity rather than charging a search credit.
export const FREE_BASELINE_EDIT_COOLDOWN_HOURS = 4;
