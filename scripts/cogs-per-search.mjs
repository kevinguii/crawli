/**
 * COGS readout — cost-per-search per tier, and a debt-proof check on credit-pack
 * pricing. Pure model, no API calls, $0 to run.
 *
 *   node scripts/cogs-per-search.mjs
 *
 * Source of truth for the cost inputs is docs/reference/FIRECRAWL_PRICING.md (current model)
 * + docs/core/SYSTEM_DESIGN.md §6. The tier caps mirror lib/stripe.ts TIER_CAPS and the
 * packs mirror lib/creditPacks.ts — both are duplicated here as plain numbers so
 * this script stays dependency-free (importing lib/stripe.ts would pull in the
 * Stripe SDK). If you change those files, update the constants below in the same
 * commit.
 *
 * Use this to set TIER_CAPS and credit-pack prices with real numbers: a pack's
 * per-search price MUST stay above the worst-case (Hobby) marginal cost so
 * overage is never sold below cost.
 *
 * ── Avenue A cost model (2026-06-29, Mercari native-first) ──────────────────
 * Per-search third-party cost is now eBay-dominated. Only eBay still calls
 * Firecrawl on every search (4-credit URL discovery; per-listing scrape is
 * crawl4ai = $0). Depop + Mercari are native-first and pay a ~1-credit Firecrawl
 * search-page scrape ONLY on an intermittent datacenter-IP 403 render miss
 * (~1 in 4 searches). The other 6 platforms are native-only = $0. nativeResultsCap
 * therefore has ~no effect on cost (native listings are free); it's shown in the
 * table only for context.
 */

// ── Cost model inputs (docs/reference/FIRECRAWL_PRICING.md current model) ─────────────
const EBAY_DISCOVERY_CREDITS = 4;      // 4-credit Firecrawl search, every search (eBay only)
const FALLBACK_PLATFORMS = 2;          // depop + mercari, native-first
const FALLBACK_RATE = 0.25;            // ~1 in 4 searches misses native render
const FALLBACK_CREDITS_PER = 1;        // ~1-credit Firecrawl search-page scrape
const DOLLARS_PER_CREDIT = { hobby: 0.004, standard: 0.00099 }; // $20/5k vs $99/100k
const OPENAI_PER_SEARCH = 0.001;       // eBay Akamai-403 LLM residual only (post-C1)

// Expected Firecrawl credits per full search: eBay discovery + expected fallback.
const firecrawlCredits =
  EBAY_DISCOVERY_CREDITS + FALLBACK_PLATFORMS * FALLBACK_RATE * FALLBACK_CREDITS_PER; // 4.5

// ── Mirrors lib/stripe.ts TIER_CAPS (LIVE/deployed caps; weekly searches) ───
const TIER_CAPS = {
  free: { maxSearchesPerPeriod: 5, nativeResultsCap: 8 },
  pro: { maxSearchesPerPeriod: 50, nativeResultsCap: 100 },
  max: { maxSearchesPerPeriod: 120, nativeResultsCap: 100 },
};

// ── Mirrors lib/creditPacks.ts ──────────────────────────────────────────────
const CREDIT_PACKS = [
  { id: 'small', searches: 100, priceUsd: 10 },
  { id: 'medium', searches: 300, priceUsd: 25 },
  { id: 'large', searches: 1000, priceUsd: 60 },
];

// ── Model ───────────────────────────────────────────────────────────────────
function costPerSearch(plan) {
  const firecrawl = firecrawlCredits * DOLLARS_PER_CREDIT[plan];
  const openai = OPENAI_PER_SEARCH; // flat — eBay residual only; native depth is $0
  return { firecrawl, openai, total: firecrawl + openai };
}

const usd = (n) => `$${n.toFixed(4)}`;
const usd2 = (n) => `$${n.toFixed(2)}`;

console.log('\nCOGS per search by tier (Avenue A model, Mercari native-first)\n');
console.log('Expected Firecrawl credits per full search:', firecrawlCredits,
  `( ${EBAY_DISCOVERY_CREDITS} eBay discovery + ${FALLBACK_PLATFORMS}×${FALLBACK_RATE} expected fallback )\n`);

console.log(
  ['tier', 'cap', 'native', 'Hobby/srch', 'Std/srch', 'Hobby/period', 'Std/period'].map((s) => s.padEnd(13)).join(''),
);
console.log('-'.repeat(13 * 7));

// Per-search cost is the same across tiers (native depth is free); only the
// per-period total scales with maxSearchesPerPeriod.
const hobby = costPerSearch('hobby');
const std = costPerSearch('standard');
const worstCaseHobby = hobby.total;
for (const [tier, caps] of Object.entries(TIER_CAPS)) {
  console.log(
    [
      tier,
      String(caps.maxSearchesPerPeriod),
      String(caps.nativeResultsCap),
      usd(hobby.total),
      usd(std.total),
      usd2(hobby.total * caps.maxSearchesPerPeriod),
      usd2(std.total * caps.maxSearchesPerPeriod),
    ].map((s) => s.padEnd(13)).join(''),
  );
}

console.log('\nCredit-pack pricing check (per-search price must exceed worst-case marginal cost)\n');
console.log('Worst-case marginal cost / search (Hobby):', usd(worstCaseHobby), '\n');
console.log(['pack', 'searches', 'price', '$/search', 'above cost?'].map((s) => s.padEnd(14)).join(''));
console.log('-'.repeat(14 * 5));
for (const pack of CREDIT_PACKS) {
  const perSearch = pack.priceUsd / pack.searches;
  const ok = perSearch > worstCaseHobby ? 'YES' : 'NO  ⚠️';
  console.log(
    [pack.id, String(pack.searches), usd2(pack.priceUsd), usd(perSearch), ok]
      .map((s) => s.padEnd(14)).join(''),
  );
}
console.log('\nNote: these are model estimates. Cache hits cost $0 and are not charged.');
console.log('Per-period totals assume the period cap is for one week (TIER_CAPS is weekly).\n');
