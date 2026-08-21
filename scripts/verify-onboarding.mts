import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
  needsOnboarding,
  nextStep,
  stepIndex,
  isTerminal,
  stepFromIndex,
} from '@/lib/onboarding';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}

console.log('\n=== unit: gate predicate ===');
check('null completed_at needs onboarding', needsOnboarding({ onboarding_completed_at: null }) === true);
check('set completed_at does not', needsOnboarding({ onboarding_completed_at: '2026-08-10T00:00:00Z' }) === false);

console.log('\n=== unit: step machine ===');
check('steps are the documented 6 + done', ONBOARDING_STEPS.length === 7);
check('total visible steps is 6', ONBOARDING_TOTAL_STEPS === 6);
check('branch is first', ONBOARDING_STEPS[0] === 'branch');
check('done is last', ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1] === 'done');

check('branch -> name (buyer)', nextStep('branch', 'buyer') === 'name');
check('branch -> name (reseller)', nextStep('branch', 'reseller') === 'name');
check('name -> seed', nextStep('name', 'buyer') === 'seed');
check('seed -> criteria', nextStep('seed', 'buyer') === 'criteria');
check('criteria -> alert', nextStep('criteria', 'reseller') === 'alert');
check('alert -> tail', nextStep('alert', 'buyer') === 'tail');
check('tail -> done', nextStep('tail', 'reseller') === 'done');
check('done is terminal', nextStep('done', 'buyer') === 'done');

check('isTerminal only for done', isTerminal('done') === true && isTerminal('tail') === false);

console.log('\n=== unit: step index (resume + progress bar) ===');
check('stepIndex branch = 0', stepIndex('branch') === 0);
check('stepIndex tail = 5', stepIndex('tail') === 5);
check('stepIndex clamps unknown to 0', stepIndex('nonsense' as never) === 0);

console.log('\n=== unit: step from index (resume-after-close) ===');
check('stepFromIndex 0 = branch', stepFromIndex(0) === 'branch');
check('stepFromIndex 1 = name', stepFromIndex(1) === 'name');
check('stepFromIndex 2 = seed', stepFromIndex(2) === 'seed');
check('stepFromIndex 3 = criteria', stepFromIndex(3) === 'criteria');
check('stepFromIndex 4 = alert', stepFromIndex(4) === 'alert');
check('stepFromIndex 5 = tail', stepFromIndex(5) === 'tail');
check('stepFromIndex 6 = done', stepFromIndex(6) === 'done');
check('stepFromIndex negative falls back to branch', stepFromIndex(-1) === 'branch');
check('stepFromIndex NaN falls back to branch', stepFromIndex(NaN) === 'branch');
check('stepFromIndex decimal falls back to branch', stepFromIndex(1.5) === 'branch');
check('stepFromIndex overflow falls back to branch', stepFromIndex(ONBOARDING_STEPS.length) === 'branch');

console.log('\n=== live: onboarding endpoint is auth-gated ===');
{
  const base = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/onboarding`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 1 }),
  });
  check('unauthenticated PATCH returns 401', res.status === 401, `got ${res.status}`);
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURE(S)'}\n`);
process.exit(failures === 0 ? 0 : 1);
