'use client';

import { PLATFORM_NAMES } from '@/lib/types';
import type { PlatformSales, SoldSale } from '@/lib/soldComps/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

interface Row extends SoldSale {
  platform: string;
}

/**
 * The individual completed sales, newest first.
 *
 * This is the answer to "the median says $99, off what?" and the only thing there
 * is to show when a query is too thin for a median at all (see MIN_SAMPLE — the
 * floor governs the aggregate, never these rows). Every row carries its own
 * platform label rather than the list being split per platform: unlike a pooled
 * median, which would describe neither market, a dated sale attributed to its own
 * marketplace is just a fact, and interleaving them by recency is what makes the
 * list readable.
 */
export default function SoldSalesList({
  groups,
  limit,
  footer,
}: {
  groups: PlatformSales[];
  /** Rows to render. Anything beyond this is the caller's to link out to. */
  limit: number;
  footer?: React.ReactNode;
}) {
  const rows: Row[] = groups
    .flatMap((g) => g.sales.map((s) => ({ ...s, platform: g.platform })))
    .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());

  if (rows.length === 0) return null;

  const shown = rows.slice(0, limit);
  // The true count of relevant sales, which exceeds rows.length whenever a
  // platform had more than SALES_ROW_CAP of them.
  const total = groups.reduce((sum, g) => sum + g.total, 0);
  const windowDays = Math.max(...groups.map((g) => g.windowDays));

  return (
    <div
      className="rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Recent sales
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
          last {windowDays} days
        </span>
      </div>

      <ul className="space-y-1 px-4 pb-3 pt-2">
        {shown.map((row) => (
          <li key={`${row.platform}-${row.url}`}>
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <span className="min-w-0">
                <span
                  className="block truncate text-[13px]"
                  style={{ color: 'var(--text)' }}
                  title={row.title ?? undefined}
                >
                  {row.title ?? 'Untitled listing'}
                </span>
                <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {PLATFORM_NAMES[row.platform] ?? row.platform}
                  {' · '}
                  {dateFmt.format(new Date(row.soldAt))}
                  {row.size ? ` · ${row.size}` : ''}
                </span>
              </span>
              <span
                className="shrink-0 text-sm font-semibold tabular-nums"
                style={{ color: 'var(--text)' }}
              >
                {fmt.format(row.price)}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-[11px]"
        style={{ color: 'var(--text-dim)' }}
      >
        <span>
          Showing {shown.length} of {total} sale{total === 1 ? '' : 's'}
        </span>
        {footer}
      </div>
    </div>
  );
}
