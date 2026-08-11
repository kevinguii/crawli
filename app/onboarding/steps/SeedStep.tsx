'use client';

import type { StepProps } from '../OnboardingFlow';

// Copy guardrails (§6b): no "best price" framing (C6 falsified), no sold-comps
// promise here (that lands in the tail), no Mercari.
const COPY = {
  buyer: {
    heading: 'What are you hunting?',
    sub: 'We watch 9 marketplaces at once, including Grailed, Vinted and Vestiaire.',
    examples: ['carhartt wip jacket', 'levis 501', 'north face nuptse', 'sambas'],
  },
  reseller: {
    heading: 'What are you looking to source?',
    sub: 'We watch 9 marketplaces at once, including Grailed, Vinted and Vestiaire.',
    examples: ['supreme box logo hoodie', 'nike air jordan 1', 'bape shark hoodie', 'stone island'],
  },
} as const;

export default function SeedStep({ draft, patch, advance, busy }: StepProps) {
  const copy = COPY[draft.persona ?? 'buyer'];
  const valid = draft.query.trim().length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        {copy.heading}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {copy.sub}
      </p>

      <input
        value={draft.query}
        onChange={(e) => patch({ query: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid && !busy) advance();
        }}
        placeholder="e.g. carhartt wip jacket"
        maxLength={200}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {copy.examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => patch({ query: ex })}
            className="rounded-full px-3 py-1.5 text-xs"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >
            {ex}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!valid || busy}
        onClick={advance}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
