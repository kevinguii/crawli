/**
 * Per-platform latency benchmark. Times searchAndScrape() one platform at a
 * time (no cross-platform concurrency) so each number is that platform's own
 * wall clock, not a queueing artifact.
 *
 * Run: npx tsx --env-file=.env <this file>
 */
import { searchAndScrape } from '@/lib/searchWorker';
import { NATIVE_PLATFORMS } from '@/lib/types';

const QUERIES = [
  'carhartt detroit jacket',
  'nike air jordan 1',
  'stussy hoodie',
];

const PLATFORMS = ['grailed', 'depop', 'mercari', 'thredup', 'vestiaire', 'vinted', 'poshmark', 'stockx', 'ebay'];
const CAP = 100; // Pro-tier depth

type Row = { query: string; platform: string; ms: number; count: number; err: string | null };
const rows: Row[] = [];

for (const query of QUERIES) {
  for (const platform of PLATFORMS) {
    const t0 = Date.now();
    let count = 0;
    let err: string | null = null;
    try {
      const listings = await searchAndScrape(platform, query, undefined, undefined, CAP);
      count = listings.length;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    const ms = Date.now() - t0;
    rows.push({ query, platform, ms, count, err });
    console.log(`${query.padEnd(26)} ${platform.padEnd(10)} ${String(ms).padStart(6)}ms  n=${String(count).padStart(3)}${err ? '  ERR ' + err.slice(0, 60) : ''}`);
  }
}

console.log('\n=== per-platform summary (sequential, isolated) ===');
console.log('platform    avenue      median   mean     max    avg n');
const byPlatform = new Map<string, Row[]>();
for (const r of rows) {
  if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, []);
  byPlatform.get(r.platform)!.push(r);
}
const summary: { platform: string; median: number; mean: number; max: number; avgN: number }[] = [];
for (const [platform, rs] of byPlatform) {
  const times = rs.map((r) => r.ms).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const mean = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const max = times[times.length - 1];
  const avgN = Math.round((rs.reduce((a, r) => a + r.count, 0) / rs.length) * 10) / 10;
  summary.push({ platform, median, mean, max, avgN });
}
summary.sort((a, b) => a.median - b.median);
for (const s of summary) {
  const avenue = NATIVE_PLATFORMS.has(s.platform) ? 'A native' : 'B firecrawl';
  console.log(
    `${s.platform.padEnd(11)} ${avenue.padEnd(11)} ${String(s.median).padStart(6)}  ${String(s.mean).padStart(6)}  ${String(s.max).padStart(6)}  ${s.avgN}`,
  );
}

console.log('\n=== JSON ===');
console.log(JSON.stringify({ rows, summary }, null, 2));
