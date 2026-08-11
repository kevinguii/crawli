'use client';

import { useState } from 'react';
import type { StepProps } from '../OnboardingFlow';
import { useSoldComps } from '@/lib/hooks/useSoldComps';
import SoldCompsPanel from '@/app/components/SoldCompsPanel';
import { netFlipProfit } from '@/lib/marketplaceFees';
import type { PlatformSoldStats } from '@/lib/soldComps/types';
import type { PlatformKey } from '@/lib/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function TailStep({ draft, patch, advance, busy }: StepProps) {
  const isReseller = draft.persona === 'reseller';
  const [submittedCloset, setSubmittedCloset] = useState(false);

  // Reseller: comp the thing they are sourcing. Buyer: comp something they own.
  const compQuery = isReseller ? draft.query : submittedCloset ? draft.closetQuery : '';
  const { data, loading } = useSoldComps(compQuery || null);

  const [picked, setPicked] = useState<PlatformSoldStats | null>(null);
  const stats = picked ?? data?.platforms[0] ?? null;
  const [buyPrice, setBuyPrice] = useState('');

  const buy = Number(buyPrice);
  const flip =
    stats && Number.isFinite(buy) && buy > 0
      ? netFlipProfit({
          sourcingPrice: buy,
          resalePrice: stats.medianPrice,
          platform: stats.platform as PlatformKey,
        })
      : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        {isReseller ? 'What these actually sell for' : 'Got anything sitting in your closet?'}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {isReseller
          ? 'Completed sales, per marketplace. Asking prices tell you what sellers want; these tell you what buyers paid.'
          : 'Type something you own. We will show you what it has been selling for.'}
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
          <button
            type="button"
            disabled={!draft.closetQuery.trim()}
            onClick={() => setSubmittedCloset(true)}
            className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Check it
          </button>
        </div>
      )}

      {loading && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-dim)' }}>
          Checking completed sales…
        </p>
      )}

      {!loading && compQuery && data?.available && (
        <div className="mt-6">
          <SoldCompsPanel
            platforms={data.platforms}
            selected={stats?.platform ?? null}
            onSelect={setPicked}
          />

          <div className="mt-4">
            <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
              {isReseller ? 'What would you pay for it?' : 'What did you pay for it?'}
            </label>
            <input
              inputMode="decimal"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {flip && stats && (
            <p className="mt-3 text-sm" style={{ color: 'var(--text)' }}>
              Sell at the {stats.platform} median of {fmt.format(stats.medianPrice)} and you keep{' '}
              <strong>{fmt.format(flip.payout)}</strong> after fees, netting{' '}
              <strong>{fmt.format(flip.netProfit)}</strong>.
            </p>
          )}
        </div>
      )}

      {!loading && compQuery && data && !data.available && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-dim)' }}>
          Not enough completed sales for that one yet. This works best on items with a steady
          resale market.
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={advance}
        className="mt-8 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {busy ? 'Finishing…' : 'Finish'}
      </button>
    </div>
  );
}
