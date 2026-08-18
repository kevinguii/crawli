'use client';

import { useState } from 'react';
import Link from 'next/link';
import SoldCompsPanel from './SoldCompsPanel';
import SoldCompsLockedPanel from './SoldCompsLockedPanel';
import SoldSalesList from './SoldSalesList';
import { netFlipProfit } from '@/lib/marketplaceFees';
import type { PlatformSoldStats } from '@/lib/soldComps/types';
import type { SoldCompsResponse } from '@/lib/hooks/useSoldComps';
import type { PaywallSurface } from '@/lib/analytics';
import { PLATFORM_NAMES, type PlatformKey } from '@/lib/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Sale rows rendered when the caller doesn't ask for more. */
const DEFAULT_SALES_LIMIT = 5;

type Pane = 'sales' | 'margin';

/**
 * Shared rendering for a sold-comps result: the per-platform panel, the individual
 * sales behind it, a buy-price input, and the resulting margin line. Fetching stays
 * with the caller (a plain useSoldComps(query) call) so callers keep control of
 * their own loading UI (e.g. disabling a Finish/submit button) — this component
 * only renders.
 */
export interface SoldCompsLookupProps {
  /** The submitted query. Empty string renders nothing (nothing searched yet). */
  query: string;
  loading: boolean;
  data: SoldCompsResponse | null;
  /** Label for the buy-price input, e.g. "What would you pay for it?" */
  buyLabel: string;
  /** One-line reason we ask (fees baked in, shows expected payout). */
  buyHelp: string;
  /** Which paywall surface this instance is, for the locked-state analytics. */
  surface: PaywallSurface;
  /**
   * `inline` stacks the comps and the margin calculator, which suits a short
   * surface like the onboarding tail. `tabbed` splits them, for /price-check where
   * a full sale list plus a calculator runs off the bottom of the page.
   */
  variant?: 'inline' | 'tabbed';
  /** How many individual sale rows to render. */
  salesLimit?: number;
}

export default function SoldCompsLookup({
  query,
  loading,
  data,
  buyLabel,
  buyHelp,
  surface,
  variant = 'inline',
  salesLimit = DEFAULT_SALES_LIMIT,
}: SoldCompsLookupProps) {
  const [picked, setPicked] = useState<PlatformSoldStats | null>(null);
  const [pane, setPane] = useState<Pane>('sales');
  // Free users receive a payload with no prices in it at all, so there is nothing
  // here to seed the margin calculator from — the locked branch renders instead.
  const locked = data?.locked === true;
  const unlockedData = data && !locked ? data : null;
  const stats = picked ?? unlockedData?.platforms[0] ?? null;
  // Rows carry no sample floor, so these can exist with no median to go above them.
  const salesGroups = unlockedData?.sales ?? [];
  const hasSales = salesGroups.some((g) => g.sales.length > 0);
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

  const salesPane = (
    <div className="space-y-3">
      {unlockedData && unlockedData.platforms.length > 0 ? (
        <SoldCompsPanel
          platforms={unlockedData.platforms}
          selected={stats?.platform ?? null}
          onSelect={setPicked}
        />
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Too few sales here to put a median on it. These are the ones we found.
        </p>
      )}
      {hasSales && <SoldSalesList groups={salesGroups} limit={salesLimit} />}
    </div>
  );

  const marginPane = stats ? (
    <div>
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

      {flip && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text)' }}>
          Sell at the {PLATFORM_NAMES[stats.platform] ?? stats.platform} median of{' '}
          {fmt.format(stats.medianPrice)} and you keep{' '}
          <strong>{fmt.format(flip.payout)}</strong> after fees, netting{' '}
          <strong>{fmt.format(flip.netProfit)}</strong>.
        </p>
      )}
    </div>
  ) : (
    // No aggregate cleared the sample floor, so there is no median to resell
    // against. Modelling a flip off two sales would be a made-up number.
    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
      There are too few completed sales to publish a median for this one, so there is
      nothing solid to model a flip against yet. The sales we did find are under
      Recent sales.
    </p>
  );

  return (
    <div>
      {loading && (
        <p className="text-sm" aria-live="polite" style={{ color: 'var(--text-dim)' }}>
          Checking completed sales…
        </p>
      )}

      {/* Locked users get the panel on every query, data or not — see
          SoldCompsLockedPanel. The "not enough sales" line below is therefore
          scoped to unlocked users; showing both would be contradictory, and
          telling a free user which items have no data is not the job of a
          paywall. */}
      {!loading && locked && (
        <SoldCompsLockedPanel platforms={data.platforms} query={query} surface={surface} />
      )}

      {!loading && unlockedData?.available && variant === 'tabbed' && (
        <div>
          <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
            <PaneTab label="Recent sales" active={pane === 'sales'} onClick={() => setPane('sales')} />
            <PaneTab label="Flip margin" active={pane === 'margin'} onClick={() => setPane('margin')} />
          </div>
          <div className="pt-4">{pane === 'sales' ? salesPane : marginPane}</div>
        </div>
      )}

      {!loading && unlockedData?.available && variant === 'inline' && (
        <div>
          {salesPane}
          <div className="mt-4">{marginPane}</div>
        </div>
      )}

      {!loading && !locked && data && !data.available && (
        <p className="text-sm" aria-live="polite" style={{ color: 'var(--text-dim)' }}>
          Not enough completed sales for that one yet. This works best on items with a
          steady resale market.
        </p>
      )}
    </div>
  );
}

function PaneTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="px-4 py-2 text-sm font-medium transition-colors"
      style={{
        color: active ? 'var(--text)' : 'var(--text-muted)',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      }}
    >
      {label}
    </button>
  );
}
