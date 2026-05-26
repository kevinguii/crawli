// Platforms excluded from alerts — eBay has intermittent Akamai blocks
// and LLM extraction cost that makes it unsuitable for scheduled cron runs.
// Imported by both server (alertRunner.ts) and client (CreateAlertModal.tsx).
export const ALERT_EXCLUDED_PLATFORMS = new Set(['ebay']);
