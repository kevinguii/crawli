// Splits eBay's latency into discovery (Firecrawl site: search) vs the
// per-listing scrape fan-out (sidecar, concurrency 2, 10 URLs).
// Uses a fresh query so the sidecar's 30-min per-URL cache can't skew it.
import { searchPlatform, scrapeListing } from '@/lib/firecrawl';
import { filterListingUrls } from '@/lib/parse';
import { allSettledWithConcurrency } from '@/lib/searchWorker';

const q = process.argv[2] ?? 'patagonia synchilla snap-t fleece';
const t0 = Date.now();
const raw = await searchPlatform('ebay', q);
const discovery = Date.now() - t0;
const listingUrls = filterListingUrls(raw, 'ebay').filter(
  (r, i, arr) => arr.findIndex((x) => x.url === r.url) === i,
);
console.log(`discovery:  ${discovery}ms  urls=${raw.length}  listing-urls=${listingUrls.length}`);

const toScrape = listingUrls.slice(0, 10);
const perUrl: number[] = [];
const t1 = Date.now();
const settled = await allSettledWithConcurrency(
  toScrape.map((r) => async () => {
    const s = Date.now();
    const out = await scrapeListing(r.url, 'ebay');
    perUrl.push(Date.now() - s);
    return out;
  }),
  2,
);
const scrapePhase = Date.now() - t1;
const ok = settled.filter((s) => s.status === 'fulfilled' && s.value !== null).length;
console.log(`scrape fan-out: ${scrapePhase}ms for ${toScrape.length} urls (concurrency 2), ${ok} returned data`);
console.log(`per-url ms: ${perUrl.sort((a, b) => a - b).join(', ')}`);
console.log(`TOTAL ~${discovery + scrapePhase}ms  (discovery ${Math.round((discovery / (discovery + scrapePhase)) * 100)}%, scrape ${Math.round((scrapePhase / (discovery + scrapePhase)) * 100)}%)`);
