'use client';

import type { StepProps } from '../OnboardingFlow';

// Copy guardrail C3: this is size + minPrice + maxPrice ONLY. Brand and keywords
// live in the query string. Never imply four independent criteria fields.
export default function CriteriaStep({ draft, patch, advance, busy }: StepProps) {
  const bad = draft.minPrice !== null && draft.maxPrice !== null && draft.minPrice > draft.maxPrice;

  const num = (v: string): number | null => {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Narrow it down
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        Optional. We match <strong>{draft.query || 'your search'}</strong> and everything you set
        here, together.
      </p>

      <label className="mt-6 block text-xs" style={{ color: 'var(--text-dim)' }}>
        Size
      </label>
      <input
        value={draft.size ?? ''}
        onChange={(e) => patch({ size: e.target.value.trim() === '' ? null : e.target.value })}
        placeholder="e.g. M"
        maxLength={40}
        className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
            Min price
          </label>
          <input
            inputMode="decimal"
            defaultValue={draft.minPrice ?? ''}
            onChange={(e) => patch({ minPrice: num(e.target.value) })}
            placeholder="0"
            className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
            Max price
          </label>
          <input
            inputMode="decimal"
            defaultValue={draft.maxPrice ?? ''}
            onChange={(e) => patch({ maxPrice: num(e.target.value) })}
            placeholder="Any"
            className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
      </div>

      {bad && (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
          Min price is higher than max price.
        </p>
      )}

      <button
        type="button"
        disabled={bad || busy}
        onClick={advance}
        className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
