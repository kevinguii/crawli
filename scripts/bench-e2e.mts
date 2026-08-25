// End-to-end fan-out wall clock, with and without eBay, at the real
// SEARCH_PLATFORM_CONCURRENCY. Distinct fresh queries per condition so the
// sidecar's 10-min (platform, query) cache can't make run 2 look fast.
import { runSearchJob } from '@/lib/searchWorker';

const ALL = ['grailed', 'depop', 'mercari', 'thredup', 'vestiaire', 'vinted', 'poshmark', 'stockx', 'ebay'];
const NO_EBAY = ALL.filter((p) => p !== 'ebay');

async function run(label: string, platforms: string[], query: string) {
  const t = Date.now();
  const listings = await runSearchJob(query, platforms, undefined, undefined, 100);
  const ms = Date.now() - t;
  console.log(`${label.padEnd(16)} q="${query}"  ${ms}ms  listings=${listings.length}`);
  return ms;
}

const withEbay = await run('WITH ebay', ALL, 'arcteryx beta jacket');
const withoutEbay = await run('WITHOUT ebay', NO_EBAY, 'north face nuptse puffer');
console.log(`\ndelta: ${withEbay - withoutEbay}ms  (${Math.round((1 - withoutEbay / withEbay) * 100)}% faster without eBay)`);
