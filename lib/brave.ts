import { PLATFORM_DOMAINS } from './types';
import type { RawSearchResult } from './firecrawl';
import { parseBraveHeaders, logApiUsage } from './apiMetrics';

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';

interface BraveWebResult {
  url?: string;
  title?: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (attempt < maxAttempts - 1 && typeof status === 'number' && isRetryable(status)) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export async function searchPlatformViaBrave(
  platform: string,
  query: string,
  limit = 20,
): Promise<RawSearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error('BRAVE_API_KEY not set');

  const domain = PLATFORM_DOMAINS[platform];
  if (!domain) throw new Error(`Unknown platform: ${platform}`);

  const siteQuery = `site:${domain} ${query}`;
  const url = `${BRAVE_URL}?q=${encodeURIComponent(siteQuery)}&count=${limit}`;

  const data = await withRetry(async () => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });
    if (!res.ok) {
      const err = new Error(`Brave HTTP ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }

    // Log API usage from response headers
    const metrics = parseBraveHeaders(res.headers);
    if (metrics.requestsRemaining !== undefined) {
      logApiUsage({ provider: 'brave', platform, ...metrics });
    }

    return (await res.json()) as BraveResponse;
  });

  const results = data.web?.results ?? [];
  return results
    .filter((item): item is BraveWebResult & { url: string } => !!item.url)
    .map((item) => ({
      url: item.url,
      title: item.title,
      description: item.description,
    }));
}
