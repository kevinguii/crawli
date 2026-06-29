'use client';

import { useMemo, useState } from 'react';
import { Listing, PLATFORM_NAMES } from '@/lib/types';
import type { PlatformKey } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';
import {
  FEE_PLATFORMS,
  MARKETPLACE_FEES,
  netFlipProfit,
} from '@/lib/marketplaceFees';

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
}

export default function PriceSummary({
  priceRange,
  averagePrice,
  totalCount,
  lowSource,
  highSource,
}: Props) {
  if (!priceRange || totalCount === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Low" value={fmt.format(priceRange.min)} source={lowSource} accent />
        <Metric
          label="Average"
          value={averagePrice !== null ? fmt.format(averagePrice) : '-'}
          source={`${totalCount} listing${totalCount !== 1 ? 's' : ''}`}
        />
        <Metric label="High" value={fmt.format(priceRange.max)} source={highSource} />
      </div>

      <FlipMargin averagePrice={averagePrice} priceRange={priceRange} />
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
}: {
  averagePrice: number | null;
  priceRange: { min: number; max: number };
}) {
  const compDefault = useMemo(
    () => Math.round(averagePrice ?? priceRange.max),
    [averagePrice, priceRange.max],
  );

  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformKey>('ebay');
  const [sourcing, setSourcing] = useState<string>('');
  const [resale, setResale] = useState<string>(String(compDefault));

  const sourcingNum = parseFloat(sourcing) || 0;
  const resaleNum = parseFloat(resale) || 0;

  const result = useMemo(
    () => netFlipProfit({ sourcingPrice: sourcingNum, resalePrice: resaleNum, platform }),
    [sourcingNum, resaleNum, platform],
  );

  const fee = MARKETPLACE_FEES[platform];
  const hasInputs = sourcingNum > 0 && resaleNum > 0;
  const profitColor = result.netProfit >= 0 ? 'var(--accent)' : '#dc2626';

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
                  <CompChip
                    label="avg"
                    onClick={() => setResale(String(Math.round(averagePrice ?? priceRange.max)))}
                  />
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
