import { PLATFORM_DOMAINS } from './types';
import type { RawSearchResult } from './firecrawl';

const SERPER_URL = 'https://google.serper.dev/search';

interface SerperOrganicResult {
  link?: string;
  title?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
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

export async function searchPlatformViaSerper(
  platform: string,
  query: string,
  limit = 20,
): Promise<RawSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY not set');

  const domain = PLATFORM_DOMAINS[platform];
  if (!domain) throw new Error(`Unknown platform: ${platform}`);

  const siteQuery = `site:${domain} ${query}`;

  const data = await withRetry(async () => {
    const res = await fetch(SERPER_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: siteQuery, num: limit }),
    });
    if (!res.ok) {
      const err = new Error(`Serper HTTP ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as SerperResponse;
  });

  const organic = data.organic ?? [];
  return organic
    .filter((item): item is SerperOrganicResult & { link: string } => !!item.link)
    .map((item) => ({
      url: item.link,
      title: item.title,
      description: item.snippet,
    }));
}
