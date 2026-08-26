/**
 * Smoke-test the crawl4ai sidecar across all 8 platforms.
 *
 * Cost: ~16 Firecrawl credits (search only, 2 per platform × 8).
 *       Zero Firecrawl scrape credits: extraction goes through the local sidecar.
 *
 * Run: node --env-file=.env scripts/test-all-platforms.mjs
 *      (requires the sidecar to be running at http://localhost:8000)
 */
import { FirecrawlClient } from '@mendable/firecrawl-js';

const SIDECAR_URL = process.env.CRAWL4AI_URL ?? 'http://localhost:8000';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not set in .env');

const client = new FirecrawlClient({ apiKey: FIRECRAWL_API_KEY });

const PLATFORM_DOMAINS = {
  grailed: 'grailed.com',
  depop: 'depop.com',
  stockx: 'stockx.com',
  poshmark: 'poshmark.com',
  ebay: 'ebay.com',
  mercari: 'mercari.com',
  vinted: 'vinted.com',
  vestiaire: 'vestiaire.com',
};

// Same patterns as lib/parse.ts so we test the URLs that the real pipeline would scrape.
const LISTING_URL_PATTERNS = {
  grailed: /grailed\.com\/listings\//,
  depop: /depop\.com\/products\//,
  stockx: /^https?:\/\/(?:www\.)?stockx\.com\/[a-z0-9][a-z0-9-]+[a-z0-9](?:\?[^/]*)?$/i,
  vestiaire: /vestiaire\.com\/.*\d{5,}/,
  vinted: /vinted\.com\/items\/\d+/,
  mercari: /mercari\.com\/us\/item\//,
  poshmark: /poshmark\.com\/listing\//,
  ebay: /ebay\.com\/itm\//,
};

const QUERY = 'Nike Air Jordan 1';

async function findFirstListingUrl(platform) {
  const data = await client.search(`site:${PLATFORM_DOMAINS[platform]} ${QUERY}`, { limit: 10 });
  const pattern = LISTING_URL_PATTERNS[platform];
  const hit = (data.web ?? []).find((r) => pattern.test(r.url ?? ''));
  return hit?.url ?? null;
}

async function scrapeViaSidecar(url, platform) {
  const res = await fetch(`${SIDECAR_URL}/scrape`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, platform }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return await res.json();
}

function summarize(result) {
  if (!result) return '(null)';
  const fields = [];
  if (result.title) fields.push(`title="${result.title.slice(0, 60)}"`);
  if (result.price !== null) fields.push(`price=${result.price} ${result.currency}`);
  if (result.isSold) fields.push('SOLD');
  if (result.condition) fields.push(`cond=${result.condition}`);
  if (result.imageUrl) fields.push('img=✓');
  return fields.join('  ');
}

console.log(`\n┌─ Sidecar all-platforms smoke test ─────────────────────────────`);
console.log(`│  query: "${QUERY}"`);
console.log(`│  sidecar: ${SIDECAR_URL}`);
console.log(`└────────────────────────────────────────────────────────────────\n`);

// Health check first
try {
  const health = await fetch(`${SIDECAR_URL}/health`).then((r) => r.json());
  console.log(`Sidecar health: ${health.status}  llm_mode=${health.llm_mode}  provider=${health.provider}\n`);
  if (health.llm_mode !== 'active') {
    console.error('⚠️  Sidecar is in stub mode, fix LLM_PROVIDER/API key in .env and restart.');
    process.exit(1);
  }
} catch (err) {
  console.error(`❌  Cannot reach sidecar at ${SIDECAR_URL}: ${err.message}`);
  console.error('    Run "npm run dev:sidecar" in another terminal first.');
  process.exit(1);
}

const platforms = Object.keys(PLATFORM_DOMAINS);
const tally = { pass: [], scrapeNull: [], noUrl: [], error: [] };

for (const platform of platforms) {
  process.stdout.write(`▸ ${platform.padEnd(10)} `);

  let url;
  try {
    url = await findFirstListingUrl(platform);
  } catch (err) {
    console.log(`SEARCH ERROR: ${err.message}`);
    tally.error.push(platform);
    continue;
  }

  if (!url) {
    console.log(`no listing URL found in search results`);
    tally.noUrl.push(platform);
    continue;
  }

  console.log(`url=${url}`);
  process.stdout.write(`  ${' '.repeat(10)}   `);

  const t0 = Date.now();
  const { result, error } = await scrapeViaSidecar(url, platform);
  const ms = Date.now() - t0;

  if (error) {
    console.log(`SCRAPE ERROR (${ms}ms): ${error}`);
    tally.error.push(platform);
  } else if (result === null) {
    console.log(`scrape returned null (${ms}ms)`);
    tally.scrapeNull.push(platform);
  } else {
    console.log(`(${ms}ms) ${summarize(result)}`);
    tally.pass.push(platform);
  }
  console.log();
}

console.log(`\n── Summary ──────────────────────────────────────────────────────`);
console.log(`✅ extracted:    ${tally.pass.join(', ') || '(none)'}`);
console.log(`⚠️  null result: ${tally.scrapeNull.join(', ') || '(none)'}`);
console.log(`⚠️  no URL:      ${tally.noUrl.join(', ') || '(none)'}`);
console.log(`❌ errors:       ${tally.error.join(', ') || '(none)'}`);
console.log();
