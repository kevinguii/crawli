import type { ReactNode } from 'react';

function Card({
  title,
  body,
  icon,
  className = '',
}: {
  title: string;
  body: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bento-card group flex flex-col rounded-2xl p-6 ${className}`}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </h3>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {body}
      </p>
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

export default function BentoFeatures() {
  return (
    <section
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
            Every feature exists to help you source underpriced inventory and
            protect your margin.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-6">
          <Card
            className="sm:col-span-3"
            title="Multi-platform search"
            body="Grailed, Depop, Poshmark, Mercari, Vinted, StockX, eBay, and Vestiaire searched simultaneously. One query, 8 platforms, seconds."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
          />
          <Card
            className="sm:col-span-3"
            title="Search alerts"
            body="Save a search. Crawli rechecks it every day and notifies you the moment a new matching listing appears on any platform."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            }
          />
          <Card
            className="sm:col-span-2"
            title="Price intelligence"
            body="See low, average, and high prices across all results. Know if you’re getting a deal before you click."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M3 17l6-6 4 4 7-8" />
                <path d="M14 7h6v6" />
              </svg>
            }
          />
          <Card
            className="sm:col-span-2"
            title="Save your finds"
            body="Heart listings to save them. Organize into folders, track price drops, share with a friend."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            }
          />
          <Card
            className="sm:col-span-2"
            title="Smart filters"
            body="Filter by platform, size, condition, color, category, and price range. Narrow results without leaving the page."
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
