import { findAlertQueryProblem, ALERT_QUERY_SEPARATORS } from '@/lib/alertConstants';
import { relevanceTokens, titleMatchesQuery } from '@/lib/parse';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}

console.log('\n=== the real broken alerts are now rejected ===');
// Taken verbatim from saved_searches on 2026-08-20. Each had run daily with 0 matches.
for (const q of [
  'hvyd, darc sport, controlled insanity, jacked jeans',
  'S4lem hoodies, rick owens',
  'Bape, supreme, jerseys',
]) {
  check(`rejected: "${q}"`, findAlertQueryProblem(q) !== null);
}

console.log('\n=== working alerts are still accepted ===');
// These currently match. Validation must not touch them.
for (const q of ['Stussy', 'Stussy ', 'carhartt wip jacket', 'num noms', 'Yeezy slides',
                 'Arcteryx', 'Nike Pegasus', 'Floral Panties']) {
  check(`accepted: "${q}"`, findAlertQueryProblem(q) === null);
}

console.log('\n=== real product names keep their punctuation ===');
// Apostrophes and hyphens are NOT separators: these are real things people search.
check("accepted: Levi's 501", findAlertQueryProblem("Levi's 501") === null);
check('accepted: wind-breaker', findAlertQueryProblem('wind-breaker') === null);
check('accepted: A$AP merch', findAlertQueryProblem('A$AP merch') === null);

console.log('\n=== every declared separator is caught ===');
for (const sep of ALERT_QUERY_SEPARATORS) {
  check(`caught "${sep}"`, findAlertQueryProblem(`bape${sep} supreme`) !== null);
}

console.log('\n=== same rule for every user: no per-tier branching in the check itself ===');
// The validator has no notion of tier at all — that lives in the UI copy, not here.
check('reports separators found, nothing else', (() => {
  const p = findAlertQueryProblem('bape, supreme / jerseys');
  return p !== null && Object.keys(p).length === 1 && p.separators.length === 2;
})());

console.log('\n=== why this matters: proof the rejected query was unmatchable ===');
const realTitle = 'Bape Shark Full Zip Hoodie Camo Green Large';
check('joined comma query does NOT match a real Bape listing',
  titleMatchesQuery(realTitle, relevanceTokens('bape, supreme, jerseys')) === false);
check('a single-term alert DOES match it',
  titleMatchesQuery(realTitle, relevanceTokens('bape')) === true);
check('precision preserved: "supreme" still does not match a Bape listing',
  titleMatchesQuery(realTitle, relevanceTokens('supreme')) === false);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
