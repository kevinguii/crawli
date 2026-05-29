'use client';

import { Listing } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
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
    <div className="grid grid-cols-3 gap-3">
      <Metric label="Low" value={fmt.format(priceRange.min)} source={lowSource} accent />
      <Metric
        label="Average"
        value={averagePrice !== null ? fmt.format(averagePrice) : '-'}
        source={`${totalCount} listing${totalCount !== 1 ? 's' : ''}`}
      />
      <Metric label="High" value={fmt.format(priceRange.max)} source={highSource} />
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
