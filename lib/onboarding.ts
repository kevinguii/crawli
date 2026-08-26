// Pure onboarding logic. No imports, no I/O: this is the only unit-testable
// surface in the feature, and scripts/verify-onboarding.mts covers it.
//
// The flow is BLOCKING (no skip, no exit until complete), so the step machine
// must always produce a reachable next state. There is deliberately no branch
// in the machine itself: both personas walk the same 5 screens and the
// tailoring lives in the screens' copy. Keeping the machine linear is what
// makes "can a user get stuck?" answerable by reading 20 lines.

export type OnboardingPersona = 'buyer' | 'reseller';

export type OnboardingStepId = 'branch' | 'name' | 'seed' | 'criteria' | 'alert' | 'tail' | 'done';

export const ONBOARDING_STEPS: OnboardingStepId[] = [
  'branch',
  'name',
  'seed',
  'criteria',
  'alert',
  'tail',
  'done',
];

/** Screens the user actually sees. 'done' is a terminal state, not a screen. */
export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length - 1;

/** The gate. Null completion timestamp means the user is blocked into the flow. */
export function needsOnboarding(profile: { onboarding_completed_at: string | null }): boolean {
  return profile.onboarding_completed_at === null;
}

/** Position of a step, used for the progress indicator and for resume-after-close.
 *  Unknown values clamp to 0 rather than throwing: a corrupt persisted step must
 *  restart the flow, never crash a blocking page. */
export function stepIndex(step: OnboardingStepId): number {
  const i = ONBOARDING_STEPS.indexOf(step);
  return i === -1 ? 0 : i;
}

export function isTerminal(step: OnboardingStepId): boolean {
  return step === 'done';
}

/** Linear advance. `persona` is accepted so callers do not need to know the
 *  machine is currently persona-independent; if a future branch is added, only
 *  this function changes. */
export function nextStep(step: OnboardingStepId, _persona: OnboardingPersona | null): OnboardingStepId {
  if (isTerminal(step)) return 'done';
  const i = stepIndex(step);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)];
}

/** Resume target for a persisted step index. Out-of-range restarts the flow. */
export function stepFromIndex(i: number): OnboardingStepId {
  if (!Number.isInteger(i) || i < 0 || i >= ONBOARDING_STEPS.length) return 'branch';
  return ONBOARDING_STEPS[i];
}

/** Linear retreat, the inverse of nextStep. Clamps at 'branch': there is
 *  nothing before the first screen. Local navigation only: going back does
 *  not persist, so a resume-after-close still lands at the furthest step
 *  actually reached, not wherever the user last backed up to. */
export function prevStep(step: OnboardingStepId): OnboardingStepId {
  const i = stepIndex(step);
  return ONBOARDING_STEPS[Math.max(i - 1, 0)];
}
