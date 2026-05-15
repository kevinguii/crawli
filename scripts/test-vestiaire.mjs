/**
 * Verify vestiaire pipeline with a luxury query (the sneaker query returns
 * zero results from Firecrawl/Google for site:vestiaire.com).
 * Cost: 2 Firecrawl search credits + 1 sidecar scrape (~$0.002 LLM).
 */
import { FirecrawlClient } from '@mendable/firecrawl-js';

const client = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY });
const PATTERN = /vestiaire\.com\/.*\d{5,}/;

const data = await client.search('site:vestiaire.com Chanel bag', { limit: 10 });
const urls = (data.web ?? []).map((r) => r.url);
console.log(`Got ${urls.length} URLs:`);
for (const url of urls) console.log(`  ${PATTERN.test(url) ? '✅' : '❌'}  ${url}`);

const first = urls.find((u) => PATTERN.test(u));
if (!first) {
  console.log('\nNo listing URL found.');
  process.exit(0);
}

console.log(`\nScraping ${first} ...`);
const res = await fetch('http://localhost:8000/scrape', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: first, platform: 'vestiaire' }),
  signal: AbortSignal.timeout(60_000),
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
