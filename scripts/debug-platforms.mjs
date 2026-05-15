/**
 * Debug: show raw Firecrawl search results for poshmark + vestiaire so we
 * can see why no URLs are passing the filter (vs the search returning
 * legitimate non-listing URLs).
 *
 * Cost: 4 Firecrawl credits.
 */
import { FirecrawlClient } from '@mendable/firecrawl-js';

const client = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY });

const PLATFORMS = ['poshmark', 'vestiaire'];
const PATTERNS = {
  poshmark: /poshmark\.com\/listings\//,
  vestiaire: /vestiaire\.com\/.*\d{5,}/,
};

for (const platform of PLATFORMS) {
  console.log(`\n══ ${platform.toUpperCase()} ══`);
  const data = await client.search(`site:${platform}.com Nike Air Jordan 1`, { limit: 10 });
  const urls = (data.web ?? []).map((r) => r.url);
  console.log(`  Got ${urls.length} URLs:`);
  for (const url of urls) {
    const matches = PATTERNS[platform].test(url);
    console.log(`    ${matches ? '✅' : '❌'}  ${url}`);
  }
}
