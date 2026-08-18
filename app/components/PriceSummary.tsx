'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Listing } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';
import { useSoldComps } from '@/lib/hooks/useSoldComps';
import { useTier } from '@/lib/hooks/useTier';
import { canSeePriceIntelligence } from '@/lib/tierCaps';
import { fakePriceString, fakeSoldStats } from '@/lib/fakePricing';
import SoldCompsPanel from './SoldCompsPanel';
import SoldSalesList from './SoldSalesList';
import LockedOverlay from './LockedOverlay';
import FlipMarginCalculator from './FlipMarginCalculator';
import type { PlatformSales, PlatformSoldStats } from '@/lib/soldComps/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Sale rows shown alongside search results. The full list lives on /price-check —
 *  this panel sits above a grid of listings and is not the place for 50 rows. */
const SEARCH_PAGE_SALE_ROWS = 5;

/** Shown identically to free and Pro users on a query with no completed sales —
 *  there's nothing there to hold back from either tier, so both get the same
 *  words rather than one implying the other has an answer it doesn't. */
const SOLD_NO_DATA_TEXT =
  'Not enough completed sales for this one yet. This works best on items with a steady resale market.';

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
  const { data: sold, loading: soldLoading } = useSoldComps(query);
  const { tier } = useTier();
  const [seed, setSeed] = useState<ResaleSeed | null>(null);

  // Fail closed while the tier is still resolving — but fail closed to a neutral
  // skeleton, NOT to the paywall. Rendering the locked view during the
  // /api/billing/status round trip flashed "Upgrade to Pro" at paying users on
  // every single search (this component remounts each time, since SearchSection
  // nulls `results` on the stream's `start` event). The skeleton carries no real
  // figure either, so the fail-closed guarantee is unchanged.
  const tierResolving = tier === null;
  const unlocked = tier !== null && canSeePriceIntelligence(tier);

  const soldLocked = sold?.locked === true;
  const soldPlatforms: PlatformSoldStats[] =
    sold && !soldLocked && sold.available ? sold.platforms : [];
  // Individual sales carry no sample floor, so this can be populated when
  // soldPlatforms is empty — a query with 3 sales gets rows and no median.
  const soldSales: PlatformSales[] =
    sold && !soldLocked && sold.available ? (sold.sales ?? []) : [];

  // Fabricated backdrop for the locked view — see lib/fakePricing.ts. Sample size
  // and window pass through real (never secret, and already folds in thin
  // platforms with a sale or two — see toLockedResult); every price figure is
  // invented. Empty when the query has no real completed sales at all: owner
  // decision 2026-08-18 is that the paywall only appears where something real is
  // actually being withheld, not as a blanket screen over nothing — see the
  // shared "not enough completed sales" note below, which reads the same for
  // free and Pro alike on a query with no data.
  const fakeSoldRows: PlatformSoldStats[] = useMemo(() => {
    if (sold?.locked !== true || sold.platforms.length === 0) return [];
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

  // Sold comps resolve on their own request, well after the listings are on screen,
  // and can legitimately come back empty. Every one of those states has to say so:
  // rendering nothing made an unlocked Pro panel look identical to a broken one,
  // which is exactly how it was reported. Mirrors the states SoldCompsLookup has
  // carried since /price-check shipped.
  //
  // The aggregate and the rows are independent: the median needs MIN_SAMPLE behind
  // it, the rows need nothing, so a thin query renders rows with no median rather
  // than the whole region collapsing.
  const hasSales = soldSales.some((g) => g.sales.length > 0);
  // True on the locked payload too — `available` survives stripping, so the free
  // view can tell "we have sales for this, they're behind the lock" apart from
  // "this item has no completed sales at all".
  const soldHasData = sold?.available === true;
  let soldRegion: React.ReactNode = null;
  if (soldLoading) {
    soldRegion = <SoldCompsNote>Checking completed sales…</SoldCompsNote>;
  } else if (soldPlatforms.length > 0 || hasSales) {
    soldRegion = (
      <>
        {soldPlatforms.length > 0 ? (
          <SoldCompsPanel
            platforms={soldPlatforms}
            selected={seed?.platform ?? null}
            onSelect={selectPlatform}
          />
        ) : (
          <SoldCompsNote>
            Too few sales here to put a median on it. These are the ones we found.
          </SoldCompsNote>
        )}
        {hasSales && (
          <SoldSalesList
            groups={soldSales}
            limit={SEARCH_PAGE_SALE_ROWS}
            footer={
              query ? (
                <Link
                  href={`/price-check?q=${encodeURIComponent(query)}`}
                  className="underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  See them all in Price Check
                </Link>
              ) : null
            }
          />
        )}
      </>
    );
  } else if (sold !== null) {
    soldRegion = <SoldCompsNote>{SOLD_NO_DATA_TEXT}</SoldCompsNote>;
  } else if (query) {
    // Query was sent, nothing came back: the lookup failed rather than finding no
    // sales. Say that instead of blaming the item.
    soldRegion = <SoldCompsNote>Completed sales could not be loaded for this search.</SoldCompsNote>;
  }

  if (tierResolving) {
    return <PriceSummarySkeleton />;
  }

  if (!unlocked) {
    // Price range and average always exist here — priceRange/totalCount are
    // already guarded above — so that portion of the panel paywalls
    // unconditionally, same as always. Sold comps does not: it only renders,
    // blurred, when this specific query actually has completed sales to
    // withhold (owner decision 2026-08-18). A query with none gets the exact
    // same "not enough completed sales" note a Pro user sees, sitting OUTSIDE
    // the blur below — there's nothing real there to sell as premium, so
    // pretending otherwise with a fabricated panel is what we're not doing.
    //
    // One overlay, one upgrade prompt, covering the price-range panel — a grid
    // of real numbers under a CSS blur would be trivially unblurred via
    // devtools, so the backdrop underneath is entirely fabricated (see
    // lib/fakePricing.ts). The real priceRange/averagePrice this component
    // received are never threaded into the blurred subtree.
    return (
      <div className="space-y-3">
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
            {soldHasData && (
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
        {soldLoading && <SoldCompsNote>Checking completed sales…</SoldCompsNote>}
        {!soldLoading && sold !== null && !soldHasData && (
          <SoldCompsNote>{SOLD_NO_DATA_TEXT}</SoldCompsNote>
        )}
      </div>
    );
  }

  const askDefault = Math.round(averagePrice ?? priceRange.max);

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

      {soldRegion}
      <FlipMarginCalculator
        resaleSeed={seed ? seed.value : askDefault}
        resaleSeedKey={seed ? `${seed.platform}-${seed.nonce}` : `ask-${askDefault}`}
        quickSets={[
          ...(seed ? [{ label: 'sold', value: seed.value }] : []),
          { label: 'avg ask', value: askDefault },
          { label: 'high', value: Math.round(priceRange.max) },
        ]}
      />
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

/** One line where the sold-comps panel would be: loading, empty, or failed. Same
 *  card as the panel itself so the layout does not jump when data lands. */
function SoldCompsNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-[13px] leading-relaxed" aria-live="polite" style={{ color: 'var(--text-muted)' }}>
        {children}
      </p>
    </div>
  );
}

/** Shown only while the tier is unknown. Deliberately holds no number at all — it
 *  stands in for both the paid and the locked view without committing to either. */
function PriceSummarySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-3 gap-3">
        {['Low', 'Average', 'High'].map((label) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              {label}
            </p>
            <div
              className="mt-2 h-6 w-20 rounded-md"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            />
          </div>
        ))}
      </div>
      <div
        className="rounded-2xl px-4 py-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="h-4 w-40 rounded-md" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }} />
      </div>
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
