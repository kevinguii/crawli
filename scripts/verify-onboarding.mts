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
check('steps are the documented 5 + done', ONBOARDING_STEPS.length === 6);
check('total visible steps is 5', ONBOARDING_TOTAL_STEPS === 5);
check('branch is first', ONBOARDING_STEPS[0] === 'branch');
check('done is last', ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1] === 'done');

check('branch -> seed (buyer)', nextStep('branch', 'buyer') === 'seed');
check('branch -> seed (reseller)', nextStep('branch', 'reseller') === 'seed');
check('seed -> criteria', nextStep('seed', 'buyer') === 'criteria');
check('criteria -> alert', nextStep('criteria', 'reseller') === 'alert');
check('alert -> tail', nextStep('alert', 'buyer') === 'tail');
check('tail -> done', nextStep('tail', 'reseller') === 'done');
check('done is terminal', nextStep('done', 'buyer') === 'done');

check('isTerminal only for done', isTerminal('done') === true && isTerminal('tail') === false);

console.log('\n=== unit: step index (resume + progress bar) ===');
check('stepIndex branch = 0', stepIndex('branch') === 0);
check('stepIndex tail = 4', stepIndex('tail') === 4);
check('stepIndex clamps unknown to 0', stepIndex('nonsense' as never) === 0);

console.log('\n=== unit: step from index (resume-after-close) ===');
check('stepFromIndex 0 = branch', stepFromIndex(0) === 'branch');
check('stepFromIndex 1 = seed', stepFromIndex(1) === 'seed');
check('stepFromIndex 2 = criteria', stepFromIndex(2) === 'criteria');
check('stepFromIndex 3 = alert', stepFromIndex(3) === 'alert');
check('stepFromIndex 4 = tail', stepFromIndex(4) === 'tail');
check('stepFromIndex 5 = done', stepFromIndex(5) === 'done');
check('stepFromIndex negative falls back to branch', stepFromIndex(-1) === 'branch');
check('stepFromIndex NaN falls back to branch', stepFromIndex(NaN) === 'branch');
check('stepFromIndex decimal falls back to branch', stepFromIndex(1.5) === 'branch');
check('stepFromIndex overflow falls back to branch', stepFromIndex(ONBOARDING_STEPS.length) === 'branch');

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURE(S)'}\n`);
process.exit(failures === 0 ? 0 : 1);
