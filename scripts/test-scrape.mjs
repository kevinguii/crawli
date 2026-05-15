/**
 * Diagnostic script: tests what Firecrawl JSON extraction actually returns
 * for real listing pages on Grailed, Depop, and StockX.
 *
 * Run: node scripts/test-scrape.mjs
 */
import { FirecrawlClient } from '@mendable/firecrawl-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/FIRECRAWL_API_KEY\s*=\s*["']?([^"'\n]+)["']?/);
const apiKey = apiKeyMatch?.[1]?.trim();
if (!apiKey) throw new Error('FIRECRAWL_API_KEY not found in .env.local');

const client = new FirecrawlClient({ apiKey });

// ── Step 1: Get real listing URLs via search ───────────────────────────────

const QUERY = 'Nike Air Jordan 1 Chicago';
const PLATFORMS = {
  grailed:   { domain: 'grailed.com',  urlPattern: /grailed\.com\/listings\// },
  depop:     { domain: 'depop.com',    urlPattern: /depop\.com\/products\// },
  stockx:    { domain: 'stockx.com',   urlPattern: /^https?:\/\/(?:www\.)?stockx\.com\/[a-z0-9][a-z0-9-]+[a-z0-9](?:\?[^/]*)?$/i },
};

console.log(`\n🔍 Searching for: "${QUERY}"\n`);

const urlsToTest = [];
for (const [platform, { domain, urlPattern }] of Object.entries(PLATFORMS)) {
  const siteQuery = `site:${domain} ${QUERY}`;
  try {
    const data = await client.search(siteQuery, { limit: 10 });
    const all = data.web ?? [];
    const filtered = all.filter(r => urlPattern.test(r.url));
    console.log(`${platform}: ${all.length} search results, ${filtered.length} matching listing URL pattern`);
    console.log('  All URLs:');
    all.forEach(r => console.log(`    ${urlPattern.test(r.url) ? '✅' : '❌'} ${r.url}`));
    if (filtered.length > 0) {
      urlsToTest.push({ url: filtered[0].url, platform });
    }
  } catch (err) {
    console.error(`${platform} search failed:`, err.message);
  }
}

// ── Step 2: Scrape each URL with JSON extraction ────────────────────────────

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Product/listing title' },
    price: { type: 'number', description: 'Current price in USD as a plain number' },
    isSold: { type: 'boolean', description: 'True if the item is sold or no longer available' },
    condition: { type: 'string', description: 'Item condition, e.g. New, Used, Like New, Deadstock' },
    imageUrl: { type: 'string', description: 'Full URL of the main product image' },
  },
};

const PLATFORM_PROMPTS = {
  stockx: 'Extract the Buy Now (Lowest Ask) price as the price field. Do NOT use the Last Sale price. Do NOT include prices from related products at the bottom of the page. If no Buy Now price exists, set price to null.',
  grailed: 'Extract the listing price. If the item shows a Sold badge or is marked as sold, set isSold to true.',
  depop: 'Extract the current price after any discounts or sales. If the item is sold or unavailable, set isSold to true.',
  default: 'Extract the listing price and whether the item is sold or unavailable.',
};

console.log(`\n\n🔬 Scraping ${urlsToTest.length} listing(s) with JSON extraction...\n`);

for (const { url, platform } of urlsToTest) {
  const prompt = PLATFORM_PROMPTS[platform] ?? PLATFORM_PROMPTS.default;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Platform: ${platform}`);
  console.log(`URL: ${url}`);
  console.log(`Prompt: ${prompt}`);
  console.log('─'.repeat(70));

  try {
    const result = await client.scrape(url, {
      formats: ['markdown', { type: 'json', schema: LISTING_SCHEMA, prompt }],
      onlyMainContent: true,
      timeout: 30000,
    });

    console.log('\n📦 JSON extraction result:');
    console.log(JSON.stringify(result.json, null, 2));

    console.log('\n📄 Markdown (first 1000 chars):');
    console.log(result.markdown?.slice(0, 1000) ?? '(empty)');

    // Flag potential issues
    console.log('\n⚠️  Issues detected:');
    if (!result.json) console.log('  - json is null/undefined (extraction failed entirely)');
    if (result.json && result.json.price == null) console.log('  - price is null');
    if (result.json && result.json.isSold == null) console.log('  - isSold is null (not detected)');
    if (result.json && result.json.imageUrl == null) console.log('  - imageUrl is null');
    if (result.json && typeof result.json.price === 'string') console.log('  - price came back as string, not number:', result.json.price);

  } catch (err) {
    console.error('Scrape failed:', err.message);
  }
}

console.log('\n\nDone.');
