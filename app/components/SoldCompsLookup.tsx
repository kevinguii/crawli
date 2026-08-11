'use client';

import { useState } from 'react';
import Link from 'next/link';
import SoldCompsPanel from './SoldCompsPanel';
import { netFlipProfit } from '@/lib/marketplaceFees';
import type { SoldCompsResult, PlatformSoldStats } from '@/lib/soldComps/types';
import { PLATFORM_NAMES, type PlatformKey } from '@/lib/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Shared rendering for a sold-comps result: the per-platform panel, a buy-price
 * input, and the resulting margin line. Fetching stays with the caller (a plain
 * useSoldComps(query) call) so callers keep control of their own loading UI
 * (e.g. disabling a Finish/submit button) — this component only renders.
 */
export interface SoldCompsLookupProps {
  /** The submitted query. Empty string renders nothing (nothing searched yet). */
  query: string;
  loading: boolean;
  data: SoldCompsResult | null;
  /** Label for the buy-price input, e.g. "What would you pay for it?" */
  buyLabel: string;
  /** One-line reason we ask (fees baked in, shows expected payout). */
  buyHelp: string;
}

export default function SoldCompsLookup({ query, loading, data, buyLabel, buyHelp }: SoldCompsLookupProps) {
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

  if (!query) return null;

  return (
    <div>
      {loading && (
        <p className="text-sm" aria-live="polite" style={{ color: 'var(--text-dim)' }}>
          Checking completed sales…
        </p>
      )}

      {!loading && data?.available && (
        <div>
          <SoldCompsPanel
            platforms={data.platforms}
            selected={stats?.platform ?? null}
            onSelect={setPicked}
          />

          <div className="mt-4">
            <label className="block text-xs" style={{ color: 'var(--text-dim)' }}>
              {buyLabel}
            </label>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-dim)' }}>
              {buyHelp}{' '}
              <Link
                href="/settings#platform-fees"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--text-dim)' }}
              >
                See the fee breakdown
              </Link>
              .
            </p>
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
              Sell at the {PLATFORM_NAMES[stats.platform] ?? stats.platform} median of{' '}
              {fmt.format(stats.medianPrice)} and you keep{' '}
              <strong>{fmt.format(flip.payout)}</strong> after fees, netting{' '}
              <strong>{fmt.format(flip.netProfit)}</strong>.
            </p>
          )}
        </div>
      )}

      {!loading && data && !data.available && (
        <p className="text-sm" aria-live="polite" style={{ color: 'var(--text-dim)' }}>
          Not enough completed sales for that one yet. This works best on items with a steady
          resale market.
        </p>
      )}
    </div>
  );
}
