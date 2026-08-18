'use client';

import { useState } from 'react';
import Link from 'next/link';
import SoldCompsPanel from './SoldCompsPanel';
import SoldCompsLockedPanel from './SoldCompsLockedPanel';
import SoldSalesList from './SoldSalesList';
import FlipMarginCalculator from './FlipMarginCalculator';
import type { PlatformSoldStats } from '@/lib/soldComps/types';
import type { SoldCompsResponse } from '@/lib/hooks/useSoldComps';
import type { PaywallSurface } from '@/lib/analytics';
import type { PlatformKey } from '@/lib/types';

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
  /** Label for the flip calculator's sourcing-price field, e.g. "What would you pay
   *  for it?" vs "What did you pay for it?" for the buyer-persona framing. */
  buyLabel: string;
  /** One-line reason we ask (fees baked in, shows expected payout). */
  buyHelp: string;
  /** Which paywall surface this instance is, for the locked-state analytics. */
  surface: PaywallSurface;
  /**
   * `inline` stacks the market snapshot, sales, and margin calculator, which suits
   * a short surface like the onboarding tail. `tabbed` is for /price-check: on
   * mobile it keeps the same two-tab split, but at `lg+` it lays out as a dashboard
   * — sales list on the left, snapshot + margin calculator stacked on the right.
   */
  variant?: 'inline' | 'tabbed';
  /** How many individual sale rows to render. */
  salesLimit?: number;
  /** Rows shown before a "Show all" toggle appears. Omit to always show every row
   *  up to `salesLimit` (the default) — set this when `salesLimit` is large enough
   *  that showing it all upfront would be overwhelming. */
  salesInitialVisible?: number;
  /** Whether the flip calculator starts expanded. Defaults closed, matching the
   *  collapsible disclosure used everywhere else it appears. */
  marginDefaultOpen?: boolean;
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
  salesInitialVisible,
  marginDefaultOpen = false,
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

  if (!query) return null;

  // Split into three pieces rather than one "sales" blob: the snapshot (per-platform
  // median/range/sample-size cards — also the platform picker for the calculator)
  // and the raw sale rows read as separate things on a wide screen, even though the
  // `tabbed` variant's mobile view still groups them under one "Recent sales" tab.
  const snapshotPane =
    unlockedData && unlockedData.platforms.length > 0 ? (
      <SoldCompsPanel
        platforms={unlockedData.platforms}
        selected={stats?.platform ?? null}
        onSelect={setPicked}
      />
    ) : (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Too few sales here to put a median on it. These are the ones we found.
      </p>
    );

  const salesListPane = hasSales ? (
    <SoldSalesList groups={salesGroups} limit={salesLimit} initialVisible={salesInitialVisible} />
  ) : (
    // Can happen even when platforms/snapshot has data: a still-cached lookup from
    // before the individual-sales field existed normalizes to sales: [] until it
    // naturally expires (24h TTL). This pane must never collapse to nothing — in
    // the tabbed variant's lg+ layout it's a standalone grid cell, not tucked
    // under a tab, so a bare null here reads as a broken left column.
    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
      No individual sale rows to show yet for this one.
    </p>
  );

  const marginPane = stats ? (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
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
      <FlipMarginCalculator
        resaleSeed={stats.medianPrice}
        resaleSeedKey={`${stats.platform}-${stats.medianPrice}`}
        initialPlatform={stats.platform as PlatformKey}
        quickSets={[{ label: 'sold', value: stats.medianPrice }]}
        sourcingLabel={buyLabel}
        defaultOpen={marginDefaultOpen}
      />
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="col-span-full flex gap-1 lg:hidden" style={{ borderBottom: '1px solid var(--border)' }}>
            <PaneTab label="Recent sales" active={pane === 'sales'} onClick={() => setPane('sales')} />
            <PaneTab label="Flip margin" active={pane === 'margin'} onClick={() => setPane('margin')} />
          </div>

          {/* Snapshot renders before the sales list in DOM order (mobile's "Recent
              sales" tab stacks them in that order); explicit grid placement below
              puts it in the sticky right rail regardless, at lg+. */}
          <div className={`${pane === 'sales' ? 'block' : 'hidden'} space-y-3 pt-4 lg:hidden`}>
            {snapshotPane}
          </div>

          <div className={`${pane === 'sales' ? 'block' : 'hidden'} pt-4 lg:block lg:pt-0 lg:col-start-1 lg:row-start-1`}>
            {salesListPane}
          </div>

          {/* Right rail: sticky at lg+ so it stays visible while scrolling a long
              sales list on the left instead of scrolling away with it. The wrapper
              itself is NOT hidden below lg — marginPane lives here and must still
              render under the mobile "Flip margin" tab. Snapshot is duplicated here
              (desktop-only, hidden below lg) rather than shared with the mobile copy
              above, since a single instance can't sit in two DOM positions across
              the breakpoint — it's presentational (no internal state), so this is
              safe; marginPane is never duplicated since FlipMarginCalculator does
              carry internal state. */}
          <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
            <div className="hidden lg:block">{snapshotPane}</div>
            <div className={`${pane === 'margin' ? 'block' : 'hidden'} pt-4 lg:block lg:mt-4 lg:pt-0`}>
              {marginPane}
            </div>
          </div>
        </div>
      )}

      {!loading && unlockedData?.available && variant === 'inline' && (
        <div className="space-y-3">
          {snapshotPane}
          {salesListPane}
          <div className="mt-1">{marginPane}</div>
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
