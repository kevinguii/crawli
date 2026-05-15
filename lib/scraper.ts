import type { ScrapedListing } from './firecrawl';

const SIDECAR_URL = process.env.CRAWL4AI_URL ?? 'http://localhost:8000';

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function scrapeViaSidecar(
  url: string,
  platform: string,
  maxAttempts = 3
): Promise<ScrapedListing | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`${SIDECAR_URL}/scrape`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, platform }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!res.ok) {
        if (attempt < maxAttempts - 1 && isRetryable(res.status)) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        return null;
      }

      const data = (await res.json()) as { result: ScrapedListing | null };
      return data.result;
    } catch {
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }
  return null;
}
