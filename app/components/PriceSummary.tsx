'use client';

import { useEffect, useMemo, useState } from 'react';
import { Listing, PLATFORM_NAMES } from '@/lib/types';
import type { PlatformKey } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';
import {
  FEE_PLATFORMS,
  MARKETPLACE_FEES,
  netFlipProfit,
} from '@/lib/marketplaceFees';
import { useSoldComps } from '@/lib/hooks/useSoldComps';
import { useTier } from '@/lib/hooks/useTier';
import { canSeePriceIntelligence } from '@/lib/tierCaps';
import { fakePriceString, fakeSoldStats } from '@/lib/fakePricing';
import SoldCompsPanel from './SoldCompsPanel';
import LockedOverlay from './LockedOverlay';
import type { PlatformSoldStats } from '@/lib/soldComps/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const fmt2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

interface Props {
  priceRange: { min: number; max: number } | null;
  averagePrice: number | null;
  totalCount: number;
  lowSource?: string | null;
  highSource?: string | null;
  /** The search query, used to look up completed sales. */
  query?: string | null;
}

/** The resale figure feeding the margin calculator. `nonce` lets the user re-apply
 *  the same platform's median after hand-editing the field. */
interface ResaleSeed {
  value: number;
  platform: string;
  nonce: number;
}

export default function PriceSummary({
  priceRange,
  averagePrice,
  totalCount,
  lowSource,
  highSource,
  query,
}: Props) {
  const { data: sold } = useSoldComps(query);
  const { tier } = useTier();
  const [seed, setSeed] = useState<ResaleSeed | null>(null);

  // Fail closed while the tier is still resolving: show the locked view until we
  // know otherwise, so the paid numbers never flash on screen for a free user.
  const unlocked = tier !== null && canSeePriceIntelligence(tier);

  const soldLocked = sold?.locked === true;
  const soldPlatforms: PlatformSoldStats[] =
    sold && !soldLocked && sold.available ? sold.platforms : [];

  // Fabricated backdrop for the locked view — see lib/fakePricing.ts. Sample size
  // and window pass through real (never secret); every price figure is invented.
  const fakeSoldRows: PlatformSoldStats[] = useMemo(() => {
    if (!sold || sold.locked !== true || !sold.available) return [];
    return sold.platforms.map((p) => fakeSoldStats(p, query ?? 'x'));
  }, [sold, query]);

  // Seed once from platforms[0] (Grailed when it qualified — see lib/soldComps).
  // Keyed on the platform name so a new search reseeds but a re-render does not
  // clobber a value the user picked or typed.
  const primary = soldPlatforms[0] ?? null;
  useEffect(() => {
    if (primary) setSeed({ value: primary.medianPrice, platform: primary.platform, nonce: 0 });
    else setSeed(null);
  }, [primary?.platform, primary?.medianPrice]);

  if (!priceRange || totalCount === 0) return null;

  const selectPlatform = (p: PlatformSoldStats) =>
    setSeed((prev) => ({
      value: p.medianPrice,
      platform: p.platform,
      nonce: (prev?.nonce ?? 0) + 1,
    }));

  const countLabel = `${totalCount} listing${totalCount !== 1 ? 's' : ''}`;

  if (!unlocked) {
    // One overlay, one upgrade prompt, covering the whole panel — a grid of real
    // numbers under a CSS blur would be trivially unblurred via devtools, so the
    // backdrop underneath is entirely fabricated (see lib/fakePricing.ts). The
    // real priceRange/averagePrice this component received are never threaded
    // into the blurred subtree.
    return (
      <LockedOverlay
        surface="search_results"
        title="Prices are here. The read on them is Pro."
        body={`We found ${countLabel} for this search. Pro shows the low, median and high across them, what the item has actually been selling for, and your margin after fees.`}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Low" value={fakePriceString(`${query ?? ''}-${totalCount}-low`, 20, 180)} accent />
            <Metric label="Average" value={fakePriceString(`${query ?? ''}-${totalCount}-avg`, 60, 260)} source={countLabel} />
            <Metric label="High" value={fakePriceString(`${query ?? ''}-${totalCount}-high`, 180, 480)} />
          </div>
          {fakeSoldRows.length > 0 && (
            <SoldCompsPanel platforms={fakeSoldRows} selected={null} onSelect={() => {}} />
          )}
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Suggested flip margin
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Estimate profit
            </span>
          </div>
        </div>
      </LockedOverlay>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Low" value={fmt.format(priceRange.min)} source={lowSource} accent />
        <Metric
          label="Average"
          value={averagePrice !== null ? fmt.format(averagePrice) : '-'}
          source={countLabel}
        />
        <Metric label="High" value={fmt.format(priceRange.max)} source={highSource} />
      </div>

      <SoldCompsPanel
        platforms={soldPlatforms}
        selected={seed?.platform ?? null}
        onSelect={selectPlatform}
      />
      <FlipMargin averagePrice={averagePrice} priceRange={priceRange} seed={seed} />
    </div>
  );
}

function Metric({
  label,
  value,
  source,
  accent,
}: {
  label: string;
  value: string;
  source?: string | null;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
        {value}
      </p>
      {source && (
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {source}
        </p>
      )}
    </div>
  );
}

/**
 * Suggested flip margin: enter a sourcing price, pick the destination platform,
 * and see net profit after that platform's seller-side fees. The resale price
 * defaults to the cross-platform comp surfaced by this search (average, with a
 * one-tap switch to the high) and stays fully editable.
 *
 * All fee math comes from lib/marketplaceFees.ts — never hardcoded here.
 */
function FlipMargin({
  averagePrice,
  priceRange,
  seed,
}: {
  averagePrice: number | null;
  priceRange: { min: number; max: number };
  /** Median of completed sales, when we have enough of them. Null falls back to
   *  the previous behaviour (average asking price). */
  seed: ResaleSeed | null;
}) {
  const askDefault = useMemo(
    () => Math.round(averagePrice ?? priceRange.max),
    [averagePrice, priceRange.max],
  );

  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformKey>('ebay');
  const [sourcing, setSourcing] = useState<string>('');
  const [resale, setResale] = useState<string>(String(askDefault));

  // Sold comps arrive after the first render, so the field starts on average ask and
  // switches once real sale data lands. nonce is in the deps so tapping the same
  // platform again re-applies it after a manual edit.
  useEffect(() => {
    if (seed) setResale(String(Math.round(seed.value)));
  }, [seed?.value, seed?.nonce]);

  const sourcingNum = parseFloat(sourcing) || 0;
  const resaleNum = parseFloat(resale) || 0;

  const result = useMemo(
    () => netFlipProfit({ sourcingPrice: sourcingNum, resalePrice: resaleNum, platform }),
    [sourcingNum, resaleNum, platform],
  );

  const fee = MARKETPLACE_FEES[platform];
  const hasInputs = sourcingNum > 0 && resaleNum > 0;
  const profitColor = result.netProfit >= 0 ? '#22c55e' : '#dc2626';

  return (
    <div
      className="rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Suggested flip margin
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {open ? 'Hide' : 'Estimate profit'}
        </span>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="You pay (sourcing)">
              <NumberInput
                value={sourcing}
                onChange={setSourcing}
                placeholder="0"
              />
            </Field>

            <Field label="Sell on">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PlatformKey)}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                {FEE_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_NAMES[p] ?? MARKETPLACE_FEES[p].label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Resale price"
              hint={
                <span className="flex gap-2">
                  {seed && (
                    <CompChip
                      label="sold"
                      onClick={() => setResale(String(Math.round(seed.value)))}
                    />
                  )}
                  <CompChip label="avg ask" onClick={() => setResale(String(askDefault))} />
                  <CompChip label="high" onClick={() => setResale(String(Math.round(priceRange.max)))} />
                </span>
              }
            >
              <NumberInput value={resale} onChange={setResale} placeholder="0" />
            </Field>
          </div>

          {hasInputs && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Net profit" value={fmt2.format(result.netProfit)} color={profitColor} big />
                <Stat label="Margin" value={`${result.marginPct.toFixed(0)}%`} />
                <Stat label="ROI" value={`${result.roiPct.toFixed(0)}%`} />
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {fmt2.format(resaleNum)} sale − {fmt2.format(result.fees)} {fee.label} seller fees ={' '}
                {fmt2.format(result.payout)} payout − {fmt2.format(sourcingNum)} cost.{' '}
                <span style={{ color: 'var(--text-dim)' }}>Fees verified {fee.lastVerified}.</span>
              </p>
            </div>
          )}

          {!hasInputs && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Enter a sourcing price to see net profit after {fee.label} seller fees.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        $
      </span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl py-2 pl-7 pr-3 text-sm"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      />
    </div>
  );
}

function CompChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
        {label}
      </p>
      <p
        className={`mt-1 font-semibold tracking-tight ${big ? 'text-xl' : 'text-lg'}`}
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </p>
    </div>
  );
}

export function pickPriceSources(
  results: Record<string, { listings: Listing[] }>,
  priceRange: { min: number; max: number } | null
): { lowSource: string | null; highSource: string | null } {
  if (!priceRange) return { lowSource: null, highSource: null };
  let lowSource: string | null = null;
  let highSource: string | null = null;
  for (const [platform, { listings }] of Object.entries(results)) {
    for (const l of listings) {
      if (l.price === null) continue;
      const effective = l.currency === 'USD' ? l.price : (convertToUSD(l.price, l.currency) ?? null);
      if (effective === null) continue;
      if (effective === priceRange.min && !lowSource) lowSource = platform;
      if (effective === priceRange.max && !highSource) highSource = platform;
    }
  }
  return { lowSource, highSource };
}
