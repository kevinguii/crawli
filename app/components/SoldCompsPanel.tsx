'use client';

import { PLATFORM_NAMES } from '@/lib/types';
import type { PlatformSoldStats } from '@/lib/soldComps/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * What items actually sold for, as opposed to what sellers are asking.
 *
 * Deliberately renders each marketplace on its own row with its own sample size and
 * window rather than a single combined figure. The two platforms carry materially
 * different inventory for the same query (Poshmark skews youth sizes and Mid/Low
 * models, Grailed adult), so one blended number would describe neither.
 */
export default function SoldCompsPanel({
  platforms,
  selected,
  onSelect,
}: {
  platforms: PlatformSoldStats[];
  selected: string | null;
  onSelect: (stats: PlatformSoldStats) => void;
}) {
  if (platforms.length === 0) return null;

  return (
    <div
      className="rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-baseline justify-between px-4 pt-3">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Recently sold
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
          completed sales, not asking prices
        </span>
      </div>

      <div className="space-y-2 px-4 pb-4 pt-2">
        {platforms.map((p) => {
          const isSelected = selected === p.platform;
          return (
            <button
              key={p.platform}
              type="button"
              onClick={() => onSelect(p)}
              aria-pressed={isSelected}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors"
              style={{
                background: isSelected ? 'var(--accent-soft, var(--bg))' : 'var(--bg)',
                border: `1px solid ${isSelected ? 'var(--accent, var(--border))' : 'var(--border)'}`,
              }}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {PLATFORM_NAMES[p.platform] ?? p.platform}
                </span>
                <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {p.n} sale{p.n === 1 ? '' : 's'} · last {p.windowDays} days
                  {p.daysToSell !== null ? ` · ~${p.daysToSell}d to sell` : ''}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-base font-semibold" style={{ color: 'var(--text)' }}>
                  {fmt.format(p.medianPrice)}
                </span>
                <span className="block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  {fmt.format(p.p25)}–{fmt.format(p.p75)}
                </span>
              </span>
            </button>
          );
        })}

        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          Median of completed sales. Poshmark shows the listed price at time of sale —
          accepted offers are private, so its figure can read high.
        </p>
      </div>
    </div>
  );
}
