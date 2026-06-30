import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  body: string;
  icon: ReactNode;
  className?: string;
  hero?: boolean;
  preview?: ReactNode;
}

function Card({ title, body, icon, className = '', hero = false, preview }: CardProps) {
  return (
    <div
      className={`bento-card group flex flex-col rounded-2xl p-6 ${className}`}
      style={{
        background: hero
          ? 'linear-gradient(145deg, var(--bg-elevated), color-mix(in srgb, var(--accent) 6%, var(--bg-elevated)))'
          : 'var(--bg-elevated)',
        border: `1px solid ${hero ? 'color-mix(in srgb, var(--accent) 35%, var(--border))' : 'var(--border)'}`,
      }}
    >
      <div
        className={`mb-4 flex flex-shrink-0 items-center justify-center rounded-xl ${hero ? 'h-12 w-12' : 'h-10 w-10'}`}
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <h3 className={`font-semibold ${hero ? 'text-xl' : 'text-lg'}`} style={{ color: 'var(--text)' }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {body}
      </p>
      {preview && <div className="mt-5 flex-1 flex flex-col justify-end">{preview}</div>}
    </div>
  );
}

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MarginPreview() {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-dim)' }}>
        <span>Source @ $40</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
        <span>eBay @ $100</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Net profit', value: '$46.35', accent: true },
          { label: 'Margin', value: '46%', accent: false },
          { label: 'ROI', value: '116%', accent: false },
        ].map(({ label, value, accent }) => (
          <div key={label} className="text-center">
            <div
              className="text-base font-bold leading-none tabular-nums"
              style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}
            >
              {value}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px]" style={{ color: 'var(--text-dim)' }}>
        eBay fees: 13.25% FVF + $0.40 per order · Rates verified 2026-06-28
      </div>
    </div>
  );
}

function AlertPreview() {
  const criteria = [
    { label: 'Brand', value: 'Carhartt' },
    { label: 'Size', value: 'M' },
    { label: 'Max price', value: '$80' },
    { label: 'Platforms', value: 'All 9' },
  ];
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="mb-3 text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-dim)' }}
      >
        Alert criteria
      </div>
      <div className="space-y-2">
        {criteria.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
            <span
              className="rounded-md px-2 py-0.5 text-xs font-medium"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px]" style={{ color: 'var(--text-dim)' }}>
        Checks daily · Notifies only on new matches · AND logic across all criteria
      </div>
    </div>
  );
}

export default function BentoFeatures() {
  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28"
      style={{
        background:
          'linear-gradient(180deg, transparent, color-mix(in srgb, var(--accent) 4%, transparent), transparent)',
      }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            Built for resellers who buy to flip
          </h2>
          <p
            className="mt-3 text-base sm:text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            Every feature exists to help you source underpriced inventory and protect your margin.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-6">
          {/* Hero features — equal weight, large cards */}
          <Card
            className="sm:col-span-3"
            hero
            title="Flip margin calculator"
            body="Enter your sourcing price and target platform. See net profit, margin, and ROI after real seller-side fees before you spend a dollar. All 7 resale platforms covered."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                <path d="M12 18V6" />
              </svg>
            }
            preview={<MarginPreview />}
          />
          <Card
            className="sm:col-span-3"
            hero
            title="Precision sourcing alerts"
            body="Save a search with brand, size, and max-price criteria. Crawli rechecks every platform daily and notifies you only when a listing matches all your terms."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            }
            preview={<AlertPreview />}
          />

          {/* Supporting features */}
          <Card
            className="sm:col-span-2"
            title="9-platform search"
            body="Grailed, Depop, Poshmark, Mercari, Vinted, ThredUp, Vestiaire Collective, StockX, and eBay searched at once. One query, every major resale platform, in seconds."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
          />
          <Card
            className="sm:col-span-2"
            title="Price intelligence"
            body="See low, average, and high prices across all results. Know what the market actually pays before you decide to source."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M3 17l6-6 4 4 7-8" />
                <path d="M14 7h6v6" />
              </svg>
            }
          />
          <Card
            className="sm:col-span-2"
            title="Smart filters"
            body="Filter by platform, size, condition, color, and price range. Narrow to exactly the inventory you source, without leaving the page."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
            }
          />
        </div>
      </div>
    </section>
  );
}
