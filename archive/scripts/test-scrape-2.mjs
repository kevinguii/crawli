/**
 * Targeted follow-up tests:
 * 1. Depop with onlyMainContent:false and location:US
 * 2. StockX with location:US (to force USD pricing)
 * 3. A sold Grailed listing (to verify isSold detection)
 * 4. Show more markdown to understand page structure
 *
 * Run: node scripts/test-scrape-2.mjs
 */
import { FirecrawlClient } from '@mendable/firecrawl-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/FIRECRAWL_API_KEY\s*=\s*["']?([^"'\n]+)["']?/)?.[1]?.trim();
if (!apiKey) throw new Error('FIRECRAWL_API_KEY not found');

const client = new FirecrawlClient({ apiKey });

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Product/listing title' },
    price: { type: 'number', description: 'Current price in USD as a plain number, no currency symbol' },
    currency: { type: 'string', description: 'Currency of the price (USD, GBP, EUR, etc)' },
    isSold: { type: 'boolean', description: 'True if the item is sold, unavailable, or marked as sold' },
    condition: { type: 'string', description: 'Item condition e.g. New, Used, Like New, Deadstock' },
    imageUrl: { type: 'string', description: 'Full URL of the main product image' },
  },
};

async function scrapeTest(label, url, options, prompt) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`TEST: ${label}`);
  console.log(`URL: ${url}`);
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log('═'.repeat(70));
  try {
    const result = await client.scrape(url, {
      formats: ['markdown', { type: 'json', schema: LISTING_SCHEMA, prompt }],
      timeout: 30000,
      ...options,
    });
    console.log('\n📦 JSON:');
    console.log(JSON.stringify(result.json, null, 2));
    // Print full markdown to understand what the LLM actually sees
    const md = result.markdown ?? '';
    console.log(`\n📄 Full markdown (${md.length} chars total, showing first 2000):`);
    console.log(md.slice(0, 2000));
    if (md.length > 2000) console.log(`\n... [${md.length - 2000} more chars]`);
    return result;
  } catch (err) {
    console.error('Error:', err.message);
    return null;
  }
}

// ── Test 1: Depop with onlyMainContent:true (current) vs false ─────────────
const DEPOP_URL = 'https://www.depop.com/products/tal0ooo-nike-air-jordan-1-chicago/';
const DEPOP_PROMPT = 'Extract the current price after any discounts or sales. If sold or unavailable, set isSold to true.';

await scrapeTest(
  'Depop — onlyMainContent:true (current)',
  DEPOP_URL,
  { onlyMainContent: true },
  DEPOP_PROMPT
);

await scrapeTest(
  'Depop — onlyMainContent:false + location US',
  DEPOP_URL,
  { onlyMainContent: false, location: { country: 'US', languages: ['en-US'] } },
  DEPOP_PROMPT
);

// ── Test 2: StockX with location:US ────────────────────────────────────────
const STOCKX_URL = 'https://stockx.com/air-jordan-1-retro-high-og-chicago-reimagined-lost-and-found';
const STOCKX_PROMPT = 'Extract the Buy Now (Lowest Ask) price in USD. Do NOT use Last Sale price. Do NOT use prices from related products.';

await scrapeTest(
  'StockX — no location (current)',
  STOCKX_URL,
  { onlyMainContent: true },
  STOCKX_PROMPT
);

await scrapeTest(
  'StockX — location:US',
  STOCKX_URL,
  { onlyMainContent: true, location: { country: 'US', languages: ['en-US'] } },
  STOCKX_PROMPT
);

// ── Test 3: Grailed SOLD listing ───────────────────────────────────────────
// Get a Grailed listing and check if it's sold (search for a specific sold item)
console.log('\n\n🔍 Searching Grailed for a sold listing to test isSold detection...');
const searchData = await client.search('site:grailed.com sold nike air jordan 1 chicago', { limit: 5 });
const grailedUrls = (searchData.web ?? []).filter(r => /grailed\.com\/listings\//.test(r.url));
console.log('Found Grailed listing URLs:');
grailedUrls.forEach(r => console.log(' ', r.url, '-', r.title));

if (grailedUrls.length > 0) {
  await scrapeTest(
    'Grailed — checking isSold detection',
    grailedUrls[0].url,
    { onlyMainContent: true },
    'Extract the listing price. If the item shows a Sold badge, is marked as sold, or the listing is closed, set isSold to true.'
  );
}

console.log('\n\nDone.');
