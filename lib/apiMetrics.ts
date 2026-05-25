/**
 * Log API credit/usage metrics from search provider responses.
 * Firecrawl and Brave Search may expose usage info in response headers.
 * Falls back to estimation based on request parameters.
 */

export interface ApiUsageMetrics {
  provider: 'firecrawl' | 'brave' | 'serper';
  platform: string;
  creditsUsed?: number;
  creditsRemaining?: number;
  requestsRemaining?: number;
  resetDate?: string;
  estimatedCreditsUsed?: number;
}

/**
 * Parse Firecrawl response headers for credit usage.
 * Returns { creditsRemaining, resetDate, creditsUsed } if headers expose them.
 */
export function parseFirecrawlHeaders(headers: Headers | Record<string, string>): Partial<ApiUsageMetrics> {
  const headerMap = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  const metrics: Partial<ApiUsageMetrics> = { provider: 'firecrawl' };

  // Firecrawl may expose in headers like:
  // x-firecrawl-credits-remaining, x-firecrawl-credits-used, x-firecrawl-reset-date
  const creditsRemaining = headerMap['x-firecrawl-credits-remaining'];
  const creditsUsed = headerMap['x-firecrawl-credits-used'];
  const resetDate = headerMap['x-firecrawl-reset-date'];

  if (creditsRemaining) metrics.creditsRemaining = parseInt(creditsRemaining, 10);
  if (creditsUsed) metrics.creditsUsed = parseInt(creditsUsed, 10);
  if (resetDate) metrics.resetDate = resetDate;

  return metrics;
}

/**
 * Parse Brave Search response headers for usage.
 * Brave may expose: x-subscription-api-key-rate-limit, x-subscription-api-key-rate-limit-remaining
 */
export function parseBraveHeaders(headers: Headers | Record<string, string>): Partial<ApiUsageMetrics> {
  const headerMap = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  const metrics: Partial<ApiUsageMetrics> = { provider: 'brave' };

  const remaining = headerMap['x-subscription-api-key-rate-limit-remaining'];
  const total = headerMap['x-subscription-api-key-rate-limit'];

  if (remaining) metrics.requestsRemaining = parseInt(remaining, 10);
  if (total) metrics.creditsRemaining = parseInt(total, 10);

  return metrics;
}

/**
 * Estimate Firecrawl credits for a search based on result count.
 * Rule: 2 credits per 10 results (from docs). If search_limit=20, cost ~4 credits.
 */
export function estimateFirecrawlSearchCredits(searchLimit: number): number {
  return 2 * Math.ceil(searchLimit / 10);
}

/**
 * Log API usage metrics. If creditsRemaining is low (e.g., < 50), warn.
 */
export function logApiUsage(metrics: ApiUsageMetrics): void {
  const remaining = metrics.creditsRemaining ?? metrics.requestsRemaining;

  const msg = [
    `[api-metrics] provider=${metrics.provider}`,
    `platform=${metrics.platform}`,
    metrics.creditsUsed ? `used=${metrics.creditsUsed}` : '',
    remaining ? `remaining=${remaining}` : '',
    metrics.resetDate ? `reset=${metrics.resetDate}` : '',
    metrics.estimatedCreditsUsed ? `estimated=${metrics.estimatedCreditsUsed}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Warn if remaining credits are low (< 50)
  if (remaining && remaining < 50) {
    console.warn(`⚠️  ${msg}`);
  } else {
    console.info(msg);
  }
}
