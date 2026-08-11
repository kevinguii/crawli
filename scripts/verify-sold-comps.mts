import { getSoldComps } from '@/lib/soldComps';
import { fetchGrailedSold } from '@/lib/soldComps/grailed';
import { fetchPoshmarkSold } from '@/lib/soldComps/poshmark';
import { trimPriceOutliers, statsForPool, median, MIN_SAMPLE } from '@/lib/soldComps/aggregate';
import type { SoldComp } from '@/lib/soldComps/types';

function comp(price: number, soldDaysAgo: number, listedDaysBefore: number | null, title = 'carhartt wip jacket'): SoldComp {
  const soldAt = new Date(Date.now() - soldDaysAgo * 86400000);
  return {
    url: 'https://x/' + Math.random(),
    title,
    price,
    soldAt,
    listedAt: listedDaysBefore === null ? null : new Date(soldAt.getTime() - listedDaysBefore * 86400000),
    size: null,
    condition: null,
  };
}

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}

console.log('\n=== unit: aggregation ===');

// median
check('median odd', median([1, 5, 3]) === 3);
check('median even', median([1, 2, 3, 4]) === 2.5);

// IQR trim removes an extreme bundle price
{
  const base = Array.from({ length: 20 }, () => comp(100, 10, 5));
  const withOutlier = [...base, comp(5000, 10, 5)];
  const trimmed = trimPriceOutliers(withOutlier);
  check('IQR drops the $5000 outlier', trimmed.length === 20 && !trimmed.some((c) => c.price === 5000),
    `kept ${trimmed.length}/21`);
}

// sample floor
{
  const few = Array.from({ length: MIN_SAMPLE - 1 }, () => comp(100, 10, 5));
  check(`n<${MIN_SAMPLE} returns null`, statsForPool('grailed', few, 90) === null);
  const enough = Array.from({ length: MIN_SAMPLE }, () => comp(100, 10, 5));
  check(`n=${MIN_SAMPLE} returns stats`, statsForPool('grailed', enough, 90) !== null);
}

// window widening: sales are all 120d old, so 90d must fail and 180d must succeed
{
  const old = Array.from({ length: 20 }, () => comp(100, 120, 5));
  check('90d window rejects 120d-old sales', statsForPool('grailed', old, 90) === null);
  const wide = statsForPool('grailed', old, 180);
  check('180d window accepts them', wide !== null && wide.stats.windowDays === 180);
}

// days-to-sell null when too few rows carry a list date
{
  const noDates = Array.from({ length: 20 }, () => comp(100, 10, null));
  const s = statsForPool('grailed', noDates, 90);
  check('daysToSell null without list dates', s !== null && s.stats.daysToSell === null);
  const withDates = Array.from({ length: 20 }, () => comp(100, 10, 7));
  const s2 = statsForPool('grailed', withDates, 90);
  check('daysToSell computed = 7', s2 !== null && s2.stats.daysToSell === 7, `got ${s2?.stats.daysToSell}`);
}

// stats and comps agree
{
  const rows = [...Array.from({ length: 20 }, () => comp(100, 10, 5)), comp(9999, 10, 5)];
  const s = statsForPool('grailed', rows, 90);
  check('returned comps match stats.n', s !== null && s.comps.length === s.stats.n);
}

console.log('\n=== live: adapters ===');
const since90 = Math.floor(Date.now() / 1000) - 90 * 86400;

for (const q of ['carhartt wip jacket', 'supreme box logo hoodie']) {
  const g = await fetchGrailedSold(q, since90);
  const gPrices = g.map((c) => c.price);
  check(`grailed "${q}" returns sales`, g.length > 0, `n=${g.length} median $${g.length ? median(gPrices) : 0}`);
  check(`grailed "${q}" all have soldAt`, g.every((c) => c.soldAt instanceof Date && !isNaN(c.soldAt.getTime())));
  check(`grailed "${q}" mostly have listedAt`, g.filter((c) => c.listedAt).length > g.length * 0.8);
  check(`grailed "${q}" all within 90d`, g.every((c) => Date.now() - c.soldAt.getTime() <= 91 * 86400000));
}

{
  const p = await fetchPoshmarkSold('carhartt wip jacket');
  check('poshmark returns sales', p.length > 0, `n=${p.length}`);
  check('poshmark all sold with dates', p.every((c) => c.soldAt instanceof Date && !isNaN(c.soldAt.getTime())));
  // Not strictly monotonic, and it doesn't need to be — windowing filters on the
  // actual soldAt, not on position. What matters is that recently_sold is ordered
  // by recency well enough that 2 pages captures the newest sales.
  const ages = p.map((c) => (Date.now() - c.soldAt.getTime()) / 86400000);
  const half = Math.floor(ages.length / 2);
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  check('poshmark ordered by recency', med(ages.slice(0, half)) <= med(ages.slice(half)),
    `first half ${med(ages.slice(0, half)).toFixed(0)}d vs second ${med(ages.slice(half)).toFixed(0)}d`);
}

console.log('\n=== live: end to end ===');
for (const q of ['supreme box logo hoodie', 'nike air jordan 1', 'carhartt wip jacket', 'bape shark hoodie']) {
  const r = await getSoldComps(q);
  const desc = r.platforms
    .map((p) => `${p.platform}: $${p.medianPrice} (n=${p.n}, ${p.windowDays}d, dts=${p.daysToSell ?? 'n/a'})`)
    .join(' | ');
  console.log(`  "${q}" available=${r.available} :: ${desc}${r.errors.length ? ' ERRORS=' + r.errors.join(',') : ''}`);
  check(`"${q}" available`, r.available);
  check(`"${q}" no errors`, r.errors.length === 0, r.errors.join(','));
  // platforms[0] seeds the margin calculator, so Grailed must lead when it qualified.
  const hasGrailed = r.platforms.some((p) => p.platform === 'grailed');
  check(`"${q}" grailed leads when present`, !hasGrailed || r.platforms[0].platform === 'grailed');
  check(`"${q}" every stat carries n and window`,
    r.platforms.every((p) => p.n >= 10 && [90, 180, 365].includes(p.windowDays)));
}

{
  const q = 'zzzq nonexistent garment xyzzy';
  const r = await getSoldComps(q);
  console.log(`  "${q}" available=${r.available} platforms=${r.platforms.length} errors=${r.errors.join(',') || 'none'}`);
  check('obscure query renders nothing', r.available === false && r.platforms.length === 0);
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURE(S)'}\n`);
process.exit(failures === 0 ? 0 : 1);
