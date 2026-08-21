'use client';

import type { StepProps } from '../OnboardingFlow';
import StepButton from './StepButton';

export default function NameStep({ draft, patch, advance, busy }: StepProps) {
  const valid = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        What&apos;s your name?
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        We&apos;ll use this to personalize your account.
      </p>

      <div className="mt-6 grid gap-3">
        <input
          value={draft.firstName}
          onChange={(e) => patch({ firstName: e.target.value })}
          placeholder="First name"
          maxLength={100}
          autoFocus
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <input
          value={draft.lastName}
          onChange={(e) => patch({ lastName: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid && !busy) advance();
          }}
          placeholder="Last name"
          maxLength={100}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      <StepButton onClick={advance} disabled={!valid || busy}>
        {busy ? 'Saving…' : 'Continue'}
      </StepButton>
    </div>
  );
}
