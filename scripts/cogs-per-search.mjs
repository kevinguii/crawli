/**
 * COGS readout — cost-per-search per tier, and a debt-proof check on credit-pack
 * pricing. Pure model, no API calls, $0 to run.
 *
 *   node scripts/cogs-per-search.mjs
 *
 * Source of truth for the cost inputs is HANDOFF.md §9 (and docs/FIRECRAWL_PRICING.md).
 * The tier caps mirror lib/stripe.ts TIER_CAPS and the packs mirror
 * lib/creditPacks.ts — both are duplicated here as plain numbers so this script
 * stays dependency-free (importing lib/stripe.ts would pull in the Stripe SDK).
 * If you change those files, update the constants below in the same commit.
 *
 * Use this to set TIER_CAPS and credit-pack prices with real numbers: a pack's
 * per-search price MUST stay above the worst-case (Hobby) marginal cost so
 * overage is never sold below cost.
 */

// ── Cost model inputs (HANDOFF §9) ──────────────────────────────────────────
const FIRECRAWL_CREDITS_PER_PLATFORM_SEARCH = 4; // limit=20, lib/firecrawl.ts
const FIRECRAWL_SEARCH_PLATFORMS = 8;            // working Firecrawl-discovery platforms
const DOLLARS_PER_CREDIT = { hobby: 0.004, standard: 0.00099 }; // $20/5k vs $99/100k
const OPENAI_PER_SEARCH = 0.019; // concentrated on eBay/Vestiaire LLM extraction

// nativeResultsCap drives how many native-platform listings we scrape (sidecar =
// $0 + OpenAI only on LLM-fallback platforms). We model the OpenAI portion as
// scaling mildly with the cap relative to the free baseline (cap 10).
const OPENAI_BASELINE_CAP = 10;

// ── Mirrors lib/stripe.ts TIER_CAPS ─────────────────────────────────────────
const TIER_CAPS = {
  free: { maxSearchesPerPeriod: 3, nativeResultsCap: 10 },
  pro: { maxSearchesPerPeriod: 20, nativeResultsCap: 40 },
  max: { maxSearchesPerPeriod: 70, nativeResultsCap: 80 },
};

// ── Mirrors lib/creditPacks.ts ──────────────────────────────────────────────
const CREDIT_PACKS = [
  { id: 'small', searches: 50, priceUsd: 20 },
  { id: 'medium', searches: 150, priceUsd: 50 },
  { id: 'large', searches: 500, priceUsd: 150 },
];

// ── Model ───────────────────────────────────────────────────────────────────
const firecrawlCredits = FIRECRAWL_CREDITS_PER_PLATFORM_SEARCH * FIRECRAWL_SEARCH_PLATFORMS; // 32

function costPerSearch(nativeResultsCap, plan) {
  const firecrawl = firecrawlCredits * DOLLARS_PER_CREDIT[plan];
  // OpenAI scales mildly with how many native listings we extract.
  const openai = OPENAI_PER_SEARCH * (nativeResultsCap / OPENAI_BASELINE_CAP);
  return { firecrawl, openai, total: firecrawl + openai };
}

const usd = (n) => `$${n.toFixed(4)}`;
const usd2 = (n) => `$${n.toFixed(2)}`;

console.log('\nCOGS per search by tier (model from HANDOFF §9)\n');
console.log('Firecrawl credits per full search:', firecrawlCredits,
  `( ${FIRECRAWL_CREDITS_PER_PLATFORM_SEARCH} × ${FIRECRAWL_SEARCH_PLATFORMS} platforms )\n`);

console.log(
  ['tier', 'cap', 'native', 'Hobby/srch', 'Std/srch', 'Hobby/period', 'Std/period'].map((s) => s.padEnd(13)).join(''),
);
console.log('-'.repeat(13 * 7));

let worstCaseHobby = 0;
for (const [tier, caps] of Object.entries(TIER_CAPS)) {
  const hobby = costPerSearch(caps.nativeResultsCap, 'hobby');
  const std = costPerSearch(caps.nativeResultsCap, 'standard');
  worstCaseHobby = Math.max(worstCaseHobby, hobby.total);
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
console.log('Worst-case marginal cost / search (Hobby, max tier):', usd(worstCaseHobby), '\n');
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
console.log('\nNote: these are model estimates. Cache hits cost $0 and are not charged.\n');
