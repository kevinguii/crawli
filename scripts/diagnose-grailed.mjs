/**
 * Diagnose all 6 Grailed listing URLs from the search to see survival rate.
 * Run: node scripts/diagnose-grailed.mjs
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

const GRAILED_PROMPT = 'Extract the listing price. If the item shows a Sold badge or the text says "Sorry, this listing is no longer available", set isSold to true.';

// All 6 passing Grailed URLs from diagnose-counts.mjs
const GRAILED_URLS = [
  'https://www.grailed.com/listings/88723497-jordan-brand-x-nike-nike-air-jordan-1-mid-chicago-toe',
  'https://www.grailed.com/listings/57821692-nike-air-jordan-1-retro-high-og-chicago-lost-found',
  'https://www.grailed.com/listings/90870127-nike-x-off-white-off-white-x-nike-air-jordan-1-chicago',
  'https://www.grailed.com/listings/84737970-jordan-brand-nike-air-jordan-1-chicago-football-cleats',
  'https://www.grailed.com/listings/75950938-jordan-brand-x-nike-1994-air-jordan-1-chicago',
  'https://www.grailed.com/listings/79552933-jordan-brand-jordan-1-retro-low-chicago-2016',
];

console.log(`\nTesting all ${GRAILED_URLS.length} Grailed listing URLs...\n`);

let kept = 0;
const results = await Promise.allSettled(GRAILED_URLS.map(url =>
  client.scrape(url, {
    formats: [{ type: 'json', schema: LISTING_SCHEMA, prompt: GRAILED_PROMPT }],
    onlyMainContent: true,
    timeout: 25000,
  })
));

for (let i = 0; i < GRAILED_URLS.length; i++) {
  const url = GRAILED_URLS[i];
  const r = results[i];
  const slug = url.split('/').pop();

  if (r.status === 'rejected') {
    console.log(`❌ ERROR   ${slug}`);
    continue;
  }

  const json = r.value.json;
  if (!json) {
    console.log(`❌ NULL    ${slug}`);
    continue;
  }

  const status = json.isSold ? '🔴 SOLD  ' : '✅ ACTIVE';
  console.log(`${status}  $${json.price ?? 'null'}  ${json.title?.slice(0, 50) ?? '(no title)'}`);
  if (!json.isSold && (json.title || json.price)) kept++;
}

console.log(`\nResult: ${kept}/${GRAILED_URLS.length} listings survive (not sold, has data)`);
console.log(`Survival rate: ${Math.round(kept / GRAILED_URLS.length * 100)}%`);
console.log(`\nConclusion: To reliably get ~5 active Grailed listings,`);
console.log(`we need ~${Math.ceil(5 / (kept / GRAILED_URLS.length) * (6/10))} search results total.`);
