/**
 * Diagnostic: shows URL counts at each pipeline stage (search → URL filter).
 * No scraping — costs only 3 search API calls.
 * Run: node scripts/diagnose-counts.mjs
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

const QUERY = 'Nike Air Jordan 1 Chicago';

const PLATFORMS = {
  grailed: {
    domain: 'grailed.com',
    pattern: /grailed\.com\/listings\//,
    notes: 'requires /listings/ in path',
  },
  depop: {
    domain: 'depop.com',
    pattern: /depop\.com\/products\//,
    notes: 'requires /products/ in path',
  },
  stockx: {
    domain: 'stockx.com',
    pattern: /^https?:\/\/(?:www\.)?stockx\.com\/[a-z0-9][a-z0-9-]+[a-z0-9](?:\?[^/]*)?$/i,
    notes: 'single-segment slug only (no subpaths)',
  },
};

console.log(`\nDiagnosing URL filter drop-off for: "${QUERY}"\n`);
console.log('='.repeat(70));

for (const [platform, { domain, pattern, notes }] of Object.entries(PLATFORMS)) {
  console.log(`\n── ${platform.toUpperCase()} (${notes}) ──`);
  try {
    const data = await client.search(`site:${domain} ${QUERY}`, { limit: 10 });
    const all = data.web ?? [];
    const passing = all.filter(r => pattern.test(r.url));
    const failing = all.filter(r => !pattern.test(r.url));

    console.log(`  Search results: ${all.length}  →  Pass filter: ${passing.length}  →  Dropped: ${failing.length}`);

    if (passing.length > 0) {
      console.log('  ✅ PASS:');
      passing.forEach(r => console.log(`      ${r.url}`));
    }
    if (failing.length > 0) {
      console.log('  ❌ DROP:');
      failing.forEach(r => console.log(`      ${r.url}`));
    }
  } catch (err) {
    console.error(`  Search failed: ${err.message}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('Done. Next step: if filter pass count is low, check patterns above.');
console.log('If pass count is OK (5+), the drop is from scraping failures or sold filtering.\n');
