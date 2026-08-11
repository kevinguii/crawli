'use client';

import type { StepProps } from '../OnboardingFlow';
import { CLOTHING_SIZE_OPTIONS, SHOE_SIZE_OPTIONS } from '@/lib/filterOptions';
import StepButton from './StepButton';

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
      <select
        value={draft.size ?? ''}
        onChange={(e) => patch({ size: e.target.value === '' ? null : e.target.value })}
        className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        <option value="">Any size</option>
        <optgroup label="Clothing">
          {CLOTHING_SIZE_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </optgroup>
        <optgroup label="Shoes">
          {SHOE_SIZE_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </optgroup>
      </select>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
            Min price
          </label>
          <input
            inputMode="decimal"
            value={draft.minPrice ?? ''}
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
            value={draft.maxPrice ?? ''}
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

      <StepButton onClick={advance} disabled={bad || busy}>
        {busy ? 'Saving…' : 'Continue'}
      </StepButton>
    </div>
  );
}
