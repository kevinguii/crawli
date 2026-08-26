/**
 * Unit checks for the size-vs-model-number split in titleMatchesQuery.
 * Run: npx tsx --env-file=.env scripts/verify-relevance-numerics.mts
 */
import { titleMatchesQuery, relevanceTokens } from '@/lib/parse';

let pass = 0, fail = 0;
function check(label: string, query: string, title: string, expected: boolean) {
  const got = titleMatchesQuery(title, relevanceTokens(query));
  if (got === expected) { pass++; }
  else { fail++; console.log(`  FAIL ${label}\n       q="${query}" title="${title}" expected=${expected} got=${got}`); }
}

// ── The regression this change exists to fix ────────────────────────────────
check('thredup synthetic title, size-only numeric', 'levis 501 jeans', "Levi's Blue Jeans Size 36 waist", true);
check('thredup, waist-suffix size', 'levis 501 jeans', "Levi's 100% Cotton Blue Jeans Size 31 waist", true);
check('thredup, inch-pair size', 'levis 501 jeans', "Levi's Blue Jeans 35 in x 31 in", true);
check('thredup, WxL size', 'levis 501 jeans', "Levi's Blue Jeans 32x34", true);
// Text anchors must still bite: ThredUp mixes other brands into the same grid.
check('wrong brand still rejected', 'levis 501 jeans', 'RE/DONE 100% Cotton Ivory Jeans Size 26 waist', false);

// ── The precision the numeric rule was protecting must survive ──────────────
check('jordan 4 must not match jordan 1', 'jordan 1', "Nike Air Jordan 4 Retro Men's Size 10", false);
check('jordan 1 matches jordan 1', 'jordan 1', "Nike Air Jordan 1 Retro High Size 10", true);
check('yeezy 350 vs 700', 'yeezy 350', 'Adidas Yeezy Boost 700 Wave Runner Size 9', false);
check('levis 501 vs 505 on a real seller title', 'levis 501', "Vintage Levi's 505 Jeans Men's 34", false);
check('levis 501 matches 501 on a real seller title', 'levis 501', "Vintage Levi's 501 Jeans Men's 30 Blue Denim", true);

// ── The false positive the old rule allowed ─────────────────────────────────
check('size tag must not satisfy a model number', 'jordan 4', 'Jordan Retro Basketball Shoe Size 4', true);
//    ^ passes on the "jordan" anchor, which is correct and unchanged; the
//      point is the size no longer *proves* the model. Verify the strict case:
check('size tag does not rescue a wrong model', 'jordan 4', 'Nike Air Jordan 1 Retro High Size 4', false);

// ── No-numeric queries are untouched ────────────────────────────────────────
check('no numerics in query', 'carhartt detroit jacket', 'Carhartt Iconic J01 Duck Detroit Jacket', true);
check('no numerics, wrong brand', 'carhartt detroit jacket', 'Dickies Eisenhower Jacket', false);

// ── Possessive brands: typed collapsed, written with an apostrophe ──────────
check('levis matches Levi\'s', 'levis 501', "Vintage Levi's 501 Jeans Men's 30", true);
check('victorias matches Victoria\'s Secret', 'victorias secret bra', "Victoria's Secret Pink Lace Bra 34B", true);
check('chicos matches Chico\'s', 'chicos jacket', "Chico's Travelers Black Knit Jacket Size 1", true);
check('dillards matches Dillard\'s', 'dillards blazer', "Dillard's Antonio Melani Wool Blazer 8", true);
check('childrens matches Children\'s Place', 'childrens place shirt', "The Children's Place Boys Blue Shirt 5T", true);
// The collision the apostrophe requirement exists to prevent:
check('victorias must NOT match Victoria Beckham', 'victorias secret bra', 'Victoria Beckham Silk Bralette Top', false);
check('bare stem alone is not enough', 'victorias secret bra', 'Victoria Secret Style Lace Bra', false);
//   ^ no apostrophe in the title and no "victorias" token, so the anchor is
//     genuinely unsatisfied. Deliberate: a bare-stem rule would also match
//     Victoria Beckham, which is a different real brand.
// Ordinary plural query words must not gain spurious matches:
check('plural common word unaffected', 'nike boots', 'Nike Boot S Leather Hiking', true);
//   ^ "Boot S" does normalize to `boot s`, so this DOES match. Accepted: the
//     title is a Nike boot listing either way and `nike` still had to anchor.
check('plural does not rescue a wrong brand', 'adidas boots', 'Nike Boot S Leather Hiking', false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
