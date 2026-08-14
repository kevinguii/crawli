'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  nextStep,
  prevStep,
  stepIndex,
  ONBOARDING_TOTAL_STEPS,
  type OnboardingPersona,
  type OnboardingStepId,
} from '@/lib/onboarding';
import { track } from '@/lib/analytics';
import BranchStep from './steps/BranchStep';
import SeedStep from './steps/SeedStep';
import CriteriaStep from './steps/CriteriaStep';
import AlertStep from './steps/AlertStep';
import TailStep from './steps/TailStep';

export interface OnboardingDraft {
  persona: OnboardingPersona | null;
  query: string;
  size: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  alertCreated: boolean;
  closetQuery: string;
}

export interface StepProps {
  draft: OnboardingDraft;
  patch: (p: Partial<OnboardingDraft>) => void;
  advance: () => void;
  busy: boolean;
}

export default function OnboardingFlow({
  initialStep,
  initialPersona,
  replay,
}: {
  initialStep: OnboardingStepId;
  initialPersona: OnboardingPersona | null;
  replay: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStepId>(initialStep);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>({
    persona: initialPersona,
    query: '',
    size: null,
    minPrice: null,
    maxPrice: null,
    alertCreated: false,
    closetQuery: '',
  });

  const patch = useCallback((p: Partial<OnboardingDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const advance = useCallback(async () => {
    setBusy(true);
    const target = nextStep(step, draft.persona);
    const done = target === 'done';

    // Persist, but NEVER let a failed write trap the user. The flow is blocking:
    // a dead-end step is a locked account. Advance regardless, and on the final
    // step retry once before giving up, because that write is the one that
    // clears the gate.
    const body: Record<string, unknown> = { step: stepIndex(target) };
    if (draft.persona) body.persona = draft.persona;
    if (done) body.complete = true;

    let ok = false;
    for (let attempt = 0; attempt < (done ? 2 : 1) && !ok; attempt++) {
      try {
        const res = await fetch('/api/onboarding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
    }

    if (done) {
      if (!ok) {
        // The gate did not clear. Sending them to /search would bounce them
        // straight back here, which reads as a freeze. Keep them on a screen
        // that explains itself and offers a retry.
        setBusy(false);
        setStep('tail');
        window.alert('Could not save your setup. Please try Finish again.');
        return;
      }
      // Only fires once the gate actually cleared (ok === true above), and every
      // new account passes through here regardless of auth method — so this is
      // the method-agnostic activation count that sign_up can't give us for
      // Google signups.
      track({ name: 'onboarding_complete', params: { persona: draft.persona ?? 'unknown' } });
      const q = draft.query.trim();
      router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      return;
    }

    setStep(target);
    setBusy(false);
  }, [step, draft.persona, draft.query, router]);

  // Once the alert is live, earlier answers (query/size/price) can no longer
  // change what was already created — there is no edit-on-navigate, only a
  // fresh POST, and re-running that would create a duplicate. So back stays
  // available everywhere except leaving the alert screen backwards once it
  // exists; reviewing tail -> alert is still fine, nothing there is editable.
  const canGoBack = step !== 'branch' && !(step === 'alert' && draft.alertCreated);
  const back = useCallback(() => {
    setStep((s) => prevStep(s));
  }, []);

  const idx = stepIndex(step);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
        Welcome to Crawli
      </p>
      <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        A few quick questions to get you set up.
      </p>

      <div className="mb-8 flex items-center gap-2">
        {Array.from({ length: ONBOARDING_TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= idx ? 'var(--accent)' : 'var(--border)' }}
          />
        ))}
      </div>

      {replay && (
        <p className="mb-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          Redoing setup. Your existing alerts are untouched.
        </p>
      )}

      {canGoBack && (
        <button
          type="button"
          onClick={back}
          disabled={busy}
          className="mb-4 flex items-center gap-1 text-xs font-medium disabled:opacity-50"
          style={{ color: 'var(--text-dim)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
      )}

      <StepSwitch step={step} draft={draft} patch={patch} advance={advance} busy={busy} />
    </div>
  );
}

function StepSwitch({ step, ...rest }: StepProps & { step: OnboardingStepId }) {
  switch (step) {
    case 'branch':
      return <BranchStep {...rest} />;
    case 'seed':
      return <SeedStep {...rest} />;
    case 'criteria':
      return <CriteriaStep {...rest} />;
    case 'alert':
      return <AlertStep {...rest} />;
    case 'tail':
      return <TailStep {...rest} />;
    default:
      return (
        <button
          type="button"
          disabled={rest.busy}
          onClick={rest.advance}
          className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {rest.busy ? 'Saving…' : `Continue (${step})`}
        </button>
      );
  }
}
