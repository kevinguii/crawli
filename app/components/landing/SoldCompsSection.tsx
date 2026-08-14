'use client';

import PlatformBadge from '@/app/components/PlatformBadge';
import MockFrame from './MockFrame';
import CtaLink from './CtaLink';

type SoldStat = {
  platform: 'grailed' | 'poshmark';
  median: string;
  range: string;
  n: number;
  daysToSell: number;
};

const STATS: SoldStat[] = [
  { platform: 'grailed', median: '$118', range: '$95–$140', n: 23, daysToSell: 9 },
  { platform: 'poshmark', median: '$95', range: '$80–$110', n: 14, daysToSell: 14 },
];

function PriceCheckPanel() {
  return (
    <div>
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="flex-1 truncate rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          carhartt detroit jacket, hamilton brown
        </div>
        <span
          className="hidden flex-shrink-0 rounded-xl px-4 py-3 text-sm font-semibold text-white sm:inline-block"
          style={{ background: 'var(--accent)' }}
        >
          Check price
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Recently sold</span>
          <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>completed sales, not asking prices</span>
        </div>

        <div className="mt-3 space-y-2">
          {STATS.map((s) => (
            <div
              key={s.platform}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <PlatformBadge platform={s.platform} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {s.n} sales · ~{s.daysToSell}d to sell
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                  {s.median}
                </span>
                <span className="block text-[11px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
                  {s.range}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          Median of completed sales, last 90 days. Poshmark shows the listed price at time of
          sale — accepted offers are private, so its figure can read high.
        </p>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-5 py-3"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Grailed + Poshmark · included on every search, no extra credit
        </span>
        <CtaLink
          location="sold_comps"
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Start comparing free
        </CtaLink>
      </div>
    </div>
  );
}

export default function SoldCompsSection() {
  return (
    <section id="price-check" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
            Skip the guesswork
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
            See what it actually sold for
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Asking prices are what sellers want. Price Check shows the median of completed
            sales on Grailed and Poshmark, so you know the real market price before you buy
            or list.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-xl">
          <MockFrame url="thecrawli.com/price-check">
            <PriceCheckPanel />
          </MockFrame>
        </div>
      </div>
    </section>
  );
}
