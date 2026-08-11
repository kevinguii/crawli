'use client';

import type { StepProps } from '../OnboardingFlow';
import type { OnboardingPersona } from '@/lib/onboarding';
import StepButton from './StepButton';

const OPTIONS: { id: OnboardingPersona; label: string; sub: string }[] = [
  { id: 'buyer', label: 'For myself', sub: 'Hunting specific pieces across marketplaces' },
  { id: 'reseller', label: 'To resell', sub: 'Sourcing inventory to flip for profit' },
];

export default function BranchStep({ draft, patch, advance, busy }: StepProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Are you buying for yourself, or to resell?
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        This changes what we set up for you next.
      </p>

      <div className="mt-6 grid gap-3">
        {OPTIONS.map((o) => {
          const active = draft.persona === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => patch({ persona: o.id })}
              className="rounded-2xl px-4 py-4 text-left transition-colors"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <span className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
                {o.label}
              </span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-dim)' }}>
                {o.sub}
              </span>
            </button>
          );
        })}
      </div>

      <StepButton onClick={advance} disabled={!draft.persona || busy}>
        {busy ? 'Saving…' : 'Continue'}
      </StepButton>
    </div>
  );
}
