/**
 * Diagnostic: scrapes 3 URLs per platform and shows full result + why it would be dropped.
 * Run: node scripts/diagnose-scrape.mjs
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

// URLs from previous diagnose-counts.mjs run
const TEST_URLS = {
  grailed: [
    'https://www.grailed.com/listings/88723497-jordan-brand-x-nike-nike-air-jordan-1-mid-chicago-toe',
    'https://www.grailed.com/listings/57821692-nike-air-jordan-1-retro-high-og-chicago-lost-found',
    'https://www.grailed.com/listings/90870127-nike-x-off-white-off-white-x-nike-air-jordan-1-chicago',
  ],
  depop: [
    'https://www.depop.com/products/tal0ooo-nike-air-jordan-1-chicago/',
    'https://www.depop.com/products/mateusz109-nike-air-jordan-1-retro/',
    'https://www.depop.com/products/bonitacore-nike-air-jordan-retro-1/',
  ],
  stockx: [
    'https://stockx.com/air-jordan-1-retro-high-og-chicago-reimagined-lost-and-found',
    'https://stockx.com/air-jordan-1-retro-low-og-chicago-2025',
    'https://stockx.com/air-jordan-1-mid-chicago-toe',
  ],
};

const SCRAPE_OPTIONS = {
  depop: { onlyMainContent: false },
};

console.log('\nScrape diagnostic — 3 URLs per platform\n');
console.log('='.repeat(70));

for (const [platform, urls] of Object.entries(TEST_URLS)) {
  const prompt = PLATFORM_PROMPTS[platform];
  const extraOpts = SCRAPE_OPTIONS[platform] ?? {};
  let kept = 0, dropped = 0;

  console.log(`\n══ ${platform.toUpperCase()} ══`);

  for (const url of urls) {
    console.log(`\n  URL: ${url}`);
    try {
      const result = await client.scrape(url, {
        formats: [{ type: 'json', schema: LISTING_SCHEMA, prompt }],
        onlyMainContent: true,
        timeout: 25000,
        ...extraOpts,
      });

      const json = result.json;
      if (!json) {
        console.log('  → DROPPED: json is null (scrape extraction failed)');
        dropped++;
        continue;
      }

      console.log(`  → title: ${json.title ?? '(null)'}`);
      console.log(`  → price: ${json.price ?? '(null)'}  currency: ${json.currency ?? '(null)'}`);
      console.log(`  → isSold: ${json.isSold}  condition: ${json.condition ?? '(null)'}`);

      if (json.isSold === true) {
        console.log('  → DROPPED: isSold=true');
        dropped++;
      } else if (json.title === null && json.price === null) {
        console.log('  → DROPPED: both title and price are null');
        dropped++;
      } else {
        console.log('  → KEPT ✅');
        kept++;
      }
    } catch (err) {
      console.log(`  → DROPPED: scrape threw error: ${err.message}`);
      dropped++;
    }
  }

  console.log(`\n  Summary: ${kept} kept, ${dropped} dropped out of ${urls.length}`);
}

console.log('\n' + '='.repeat(70) + '\n');
