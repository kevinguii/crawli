'use client';

import { useMemo, useState } from 'react';
import { FEE_PLATFORMS, MARKETPLACE_FEES, netFlipProfit } from '@/lib/marketplaceFees';
import { PLATFORM_NAMES, type PlatformKey } from '@/lib/types';
import InfoTooltip from './InfoTooltip';

const fmt2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

/** A one-tap shortcut next to the resale field, e.g. "sold" / "avg ask" / "high". */
export interface FlipMarginQuickSet {
  label: string;
  value: number;
}

export interface FlipMarginCalculatorProps {
  /** Resale price to seed the field with. Re-applied whenever `resaleSeedKey` changes,
   *  so a caller bumps the key (or swaps it) whenever the seed itself should win over
   *  whatever the user has typed, e.g. picking a different comp. */
  resaleSeed: number;
  resaleSeedKey?: string | number;
  /** Sell-on platform to default to and re-apply alongside the resale seed. Omit to
   *  leave the platform entirely under the user's control (always starts on eBay). */
  initialPlatform?: PlatformKey;
  /** Quick-set chips next to the Resale field. Empty hides the chip row. */
  quickSets?: FlipMarginQuickSet[];
  /** Label on the sourcing-price field: callers phrase this differently ("What would
   *  you pay for it?" vs "What did you pay for it?"). */
  sourcingLabel?: string;
  title?: string;
  defaultOpen?: boolean;
}

/**
 * Sourcing price, destination platform, and resale price in, net profit/margin/ROI
 * and a fee breakdown out. All fee math comes from lib/marketplaceFees.ts, never
 * hardcoded here. Shared by the search-results panel and the standalone Price Check
 * page so there is exactly one comprehensive flip calculator in the app.
 */
export default function FlipMarginCalculator({
  resaleSeed,
  resaleSeedKey,
  initialPlatform,
  quickSets = [],
  sourcingLabel = 'You pay (sourcing)',
  title = 'Suggested flip margin',
  defaultOpen = false,
}: FlipMarginCalculatorProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [platform, setPlatform] = useState<PlatformKey>(initialPlatform ?? 'ebay');
  const [sourcing, setSourcing] = useState('');
  const [resale, setResale] = useState(String(Math.round(resaleSeed)));

  // resaleSeedKey changing means the caller wants both fields re-synced to a new
  // comp (a different sold-comps platform picked, a different chip tapped). Platform
  // only re-applies when the caller passes one at all. PriceSummary never does, so
  // its "Sell on" stays purely user-driven regardless of which comp seeded the price.
  // Render-phase adjustment rather than an effect (see ResultsDisplay.tsx's viewKey
  // pattern), since setState inside an effect body here would cascade an extra render.
  const [appliedSeedKey, setAppliedSeedKey] = useState(resaleSeedKey);
  if (appliedSeedKey !== resaleSeedKey) {
    setAppliedSeedKey(resaleSeedKey);
    setResale(String(Math.round(resaleSeed)));
    if (initialPlatform) setPlatform(initialPlatform);
  }

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
          {title}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {open ? 'Hide' : 'Estimate profit'}
        </span>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={sourcingLabel}>
              <NumberInput value={sourcing} onChange={setSourcing} placeholder="0" />
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
                quickSets.length > 0 ? (
                  <span className="flex gap-2">
                    {quickSets.map((q) => (
                      <CompChip
                        key={q.label}
                        label={q.label}
                        onClick={() => setResale(String(Math.round(q.value)))}
                      />
                    ))}
                  </span>
                ) : undefined
              }
            >
              <NumberInput value={resale} onChange={setResale} placeholder="0" />
            </Field>
          </div>

          {hasInputs && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Net profit" value={fmt2.format(result.netProfit)} color={profitColor} big />
                <Stat
                  label="Margin"
                  value={`${result.marginPct.toFixed(0)}%`}
                  tooltip="Net profit as a share of the resale price: how much of what the buyer pays is profit."
                />
                <Stat
                  label="ROI"
                  value={`${result.roiPct.toFixed(0)}%`}
                  tooltip="Net profit as a share of what you paid for it: how much you made relative to your cost."
                />
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
      {/* min-h reserves room for a 2-line label so all three fields in the row
          start their input at the same height, whether or not this particular
          label or hint actually wraps ("Sell on" is one line, "Resale price"
          wraps once the "sold" chip narrows it, "You pay (sourcing)" can wrap
          depending on the caller's copy). */}
      <div className="mb-1 flex min-h-[28px] items-start justify-between gap-2">
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
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
        {label}
        {tooltip && <InfoTooltip content={tooltip} label={`About ${label.toLowerCase()}`} />}
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
