/**
 * Simulates the app's parallel scraping to diagnose failure rates under concurrency.
 * Run: node scripts/diagnose-parallel.mjs
 */
import { FirecrawlClient } from '@mendable/firecrawl-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8');
const apiKey = envContent.match(/FIRECRAWL_API_KEY\s*=\s*["']?([^"'\n]+)["']?/)?.[1]?.trim();
if (!apiKey) throw new Error('FIRECRAWL_API_KEY not found in .env.local');

const client = new FirecrawlClient({ apiKey });

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Product/listing title' },
    price: { type: 'number', description: 'Price as a plain number with no currency symbol' },
    currency: { type: 'string', description: 'Currency code of the price, e.g. USD, GBP, EUR' },
    isSold: { type: 'boolean', description: 'True if the item is sold or no longer available' },
    condition: { type: 'string', description: 'Item condition, e.g. New, Used, Like New, Deadstock' },
    imageUrl: { type: 'string', description: 'Full URL of the main product image' },
  },
};

const PLATFORM_PROMPTS = {
  stockx: 'Extract the Buy Now (Lowest Ask) price as the price field. Do NOT use the Last Sale price. Do NOT include prices from related products at the bottom of the page. If no Buy Now price exists, set price to null.',
  grailed: 'Extract the listing price. If the item shows a Sold badge or the text says "Sorry, this listing is no longer available", set isSold to true.',
  depop: 'Extract the current price after any discounts or sales. Include the currency field (USD, GBP, EUR, etc). If the item is sold or unavailable, set isSold to true.',
};

const SCRAPE_OPTIONS = {
  depop: { onlyMainContent: false },
};

// URLs from diagnose-counts.mjs (all passing URL filter)
const PLATFORM_URLS = {
  grailed: [
    'https://www.grailed.com/listings/88723497-jordan-brand-x-nike-nike-air-jordan-1-mid-chicago-toe',
    'https://www.grailed.com/listings/57821692-nike-air-jordan-1-retro-high-og-chicago-lost-found',
    'https://www.grailed.com/listings/90870127-nike-x-off-white-off-white-x-nike-air-jordan-1-chicago',
    'https://www.grailed.com/listings/84737970-jordan-brand-nike-air-jordan-1-chicago-football-cleats',
    'https://www.grailed.com/listings/75950938-jordan-brand-x-nike-1994-air-jordan-1-chicago',
    'https://www.grailed.com/listings/79552933-jordan-brand-jordan-1-retro-low-chicago-2016',
  ],
  depop: [
    'https://www.depop.com/products/tal0ooo-nike-air-jordan-1-chicago/',
    'https://www.depop.com/products/mateusz109-nike-air-jordan-1-retro/',
    'https://www.depop.com/products/isaias_00-nike-air-jordan-1-low/',
    'https://www.depop.com/products/bonitacore-nike-air-jordan-retro-1/',
    'https://www.depop.com/products/m4nn3qu1n-nike-air-jordan-1-retro/',
    'https://www.depop.com/products/ryielleaddtinez-nike-air-jordan-1-mid-chicago/',
    'https://www.depop.com/products/dt_enterprise-nike-air-jordan-1-low/',
    'https://www.depop.com/products/gabyrgl-air-jordan-ones-og-chicago/',
    'https://www.depop.com/products/ellismersh-2015-release-nike-air-jordan/',
    'https://www.depop.com/products/marroquin71973-nike-air-jordan-1-retro/',
  ],
  stockx: [
    'https://stockx.com/air-jordan-1-retro-high-og-chicago-reimagined-lost-and-found',
    'https://stockx.com/air-jordan-1-retro-low-og-chicago-2025',
    'https://stockx.com/air-jordan-1-retro-high-og-sp-union-la-chicago-shadow',
    'https://stockx.com/air-jordan-1-mid-chicago-toe',
    'https://stockx.com/air-jordan-1-retro-high-off-white-chicago',
    'https://stockx.com/air-jordan-1-retro-high-og-chicago-reimagined-lost-and-found-gs',
    'https://stockx.com/air-jordan-1-retro-low-golf-chicago',
    'https://stockx.com/air-jordan-1-mid-wear-away-chicago',
    'https://stockx.com/air-jordan-1-retro-high-fearless-unc-chicago',
  ],
};

async function scrapeOne(url, platform) {
  const prompt = PLATFORM_PROMPTS[platform];
  const extraOpts = SCRAPE_OPTIONS[platform] ?? {};
  try {
    const result = await client.scrape(url, {
      formats: [{ type: 'json', schema: LISTING_SCHEMA, prompt }],
      onlyMainContent: true,
      timeout: 25000,
      ...extraOpts,
    });
    return { url, json: result.json ?? null, error: null };
  } catch (err) {
    return { url, json: null, error: err.message };
  }
}

console.log('\nParallel scrape diagnostic (all platforms simultaneously)\n');
console.log('='.repeat(70));

// Run all 3 platforms in parallel, each platform runs all its URLs in parallel
const [grailedResults, depopResults, stockxResults] = await Promise.all([
  Promise.allSettled(PLATFORM_URLS.grailed.map(url => scrapeOne(url, 'grailed'))),
  Promise.allSettled(PLATFORM_URLS.depop.map(url => scrapeOne(url, 'depop'))),
  Promise.allSettled(PLATFORM_URLS.stockx.map(url => scrapeOne(url, 'stockx'))),
]);

function summarize(platform, settled) {
  console.log(`\n── ${platform.toUpperCase()} (${settled.length} URLs) ──`);
  let kept = 0, sold = 0, nullJson = 0, error = 0, nullPrice = 0;
  for (const s of settled) {
    if (s.status === 'rejected') { error++; continue; }
    const { json, error: err } = s.value;
    if (err) { error++; console.log(`  ERROR: ${err.slice(0, 80)}`); continue; }
    if (!json) { nullJson++; continue; }
    const tag = json.isSold ? '🔴 SOLD' : (json.title || json.price ? '✅ KEPT' : '⚪ EMPTY');
    const priceNote = json.price == null ? ' (price=null)' : '';
    console.log(`  ${tag}  $${json.price ?? 'null'} ${json.currency ?? ''}  ${(json.title ?? '(no title)').slice(0, 45)}${priceNote}`);
    if (json.isSold) sold++;
    else if (!json.title && !json.price) nullPrice++;
    else kept++;
  }
  if (nullJson) console.log(`  NULL JSON: ${nullJson} (Firecrawl returned no extracted data)`);
  console.log(`\n  Summary: kept=${kept}  sold=${sold}  nullJson=${nullJson}  nullData=${nullPrice}  error=${error}`);
}

summarize('grailed', grailedResults);
summarize('depop', depopResults);
summarize('stockx', stockxResults);

console.log('\n' + '='.repeat(70) + '\n');
