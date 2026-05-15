import { FirecrawlClient } from '@mendable/firecrawl-js';
import { PLATFORM_DOMAINS } from './types';
import { scrapeViaSidecar } from './scraper';

const client = new FirecrawlClient({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

function isRetryable(err: unknown): boolean {
  const status =
    (err as { statusCode?: number })?.statusCode ??
    (err as { status?: number })?.status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < maxAttempts - 1 && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export interface RawSearchResult {
  url: string;
  title?: string;
  description?: string;
}

export async function searchPlatform(
  platform: string,
  query: string
): Promise<RawSearchResult[]> {
  const domain = PLATFORM_DOMAINS[platform];
  if (!domain) throw new Error(`Unknown platform: ${platform}`);

  const siteQuery = `site:${domain} ${query}`;

  // TEST_MODE: Use 10 results (2 credits per search) instead of 15 (4 credits)
  // Credit tiers: 1-10 = 2 credits, 11-20 = 4 credits, 21-30 = 6 credits
  const searchLimit = process.env.TEST_MODE === 'true' ? 10 : 15;

  const data = await withRetry(() =>
    client.search(siteQuery, { limit: searchLimit })
  );

  const web = data.web ?? [];
  return web.map((item) => ({
    url: (item as RawSearchResult).url ?? '',
    title: (item as RawSearchResult).title,
    description: (item as RawSearchResult).description,
  }));
}

// ── Individual listing scraping (delegated to crawl4ai sidecar) ────────────
// Per-platform extraction prompts and the LLM JSON schema now live in the
// Python sidecar (crawl4ai-service/extractors.py).

export interface ScrapedListing {
  url: string;
  title: string | null;
  price: number | null;
  currency: string;
  isSold: boolean;
  condition: string | null;
  imageUrl: string | null;
}

export async function scrapeListing(
  url: string,
  platform: string
): Promise<ScrapedListing | null> {
  return scrapeViaSidecar(url, platform);
}
