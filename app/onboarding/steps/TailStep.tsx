'use client';

import { useState } from 'react';
import type { StepProps } from '../OnboardingFlow';
import { useSoldComps } from '@/lib/hooks/useSoldComps';
import SoldCompsLookup from '@/app/components/SoldCompsLookup';
import StepButton from './StepButton';

export default function TailStep({ draft, patch, advance, busy }: StepProps) {
  const isReseller = draft.persona === 'reseller';
  const [submittedCloset, setSubmittedCloset] = useState(false);

  // Reseller: comp the thing they are sourcing. Buyer: comp something they own.
  const compQuery = isReseller ? draft.query : submittedCloset ? draft.closetQuery : '';
  const { data, loading } = useSoldComps(compQuery || null);

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        {isReseller ? 'What these have been selling for' : 'Got anything sitting in your closet?'}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {isReseller
          ? 'Completed sales, per marketplace — not just what\'s listed today.'
          : 'Type something you own. We will show you what it has been selling for.'}
      </p>
      <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
        Find this again anytime under Price Check in the sidebar, or automatically whenever you
        search for an item.
      </p>

      {!isReseller && !submittedCloset && (
        <div className="mt-6">
          <input
            value={draft.closetQuery}
            onChange={(e) => patch({ closetQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.closetQuery.trim()) setSubmittedCloset(true);
            }}
            placeholder="e.g. north face nuptse"
            maxLength={200}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <StepButton onClick={() => setSubmittedCloset(true)} disabled={!draft.closetQuery.trim()} className="mt-3">
            Check it
          </StepButton>
        </div>
      )}

      <div className="mt-6">
        <SoldCompsLookup
          query={compQuery}
          loading={loading}
          data={data}
          buyLabel={isReseller ? 'What would you pay for it?' : 'What did you pay for it?'}
          buyHelp={
            isReseller
              ? "We'll factor in marketplace fees and show what you'd actually pocket."
              : "We'll factor in marketplace fees and show what you could pocket if you resold it."
          }
        />
      </div>

      <StepButton onClick={advance} disabled={busy || loading} className="mt-8">
        {busy ? 'Finishing…' : loading ? 'Checking…' : 'Finish'}
      </StepButton>
    </div>
  );
}
