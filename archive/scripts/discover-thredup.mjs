/**
 * One-off discovery: list URL shapes ThredUp returns for a site: search.
 * Costs 1 Firecrawl credit (single search call).
 * Run: node scripts/discover-thredup.mjs
 */
import { FirecrawlClient } from '@mendable/firecrawl-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
const apiKey = envContent.match(/FIRECRAWL_API_KEY\s*=\s*["']?([^"'\n]+)["']?/)?.[1]?.trim();
if (!apiKey) throw new Error('FIRECRAWL_API_KEY not found in .env');

const client = new FirecrawlClient({ apiKey });

const QUERIES = [
  'nike air jordan 1',
  'levis 501 jeans',
];

for (const q of QUERIES) {
  console.log(`\n=== site:thredup.com ${q} ===`);
  try {
    const data = await client.search(`site:thredup.com ${q}`, { limit: 15 });
    const all = data.web ?? [];
    console.log(`Returned ${all.length} URLs:`);
    for (const r of all) {
      console.log(`  ${r.url}`);
      if (r.title) console.log(`      title: ${r.title.slice(0, 80)}`);
    }
  } catch (err) {
    console.error(`  Search failed: ${err.message}`);
  }
}
