import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  body: string;
  icon: ReactNode;
}

function Card({ title, body, icon }: CardProps) {
  return (
    <div
      className="bento-card group flex flex-col rounded-2xl p-6"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div
        className="mb-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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
      id="how-it-works"
      className="py-16 sm:py-20"
      style={{
        background:
          'linear-gradient(180deg, transparent, color-mix(in srgb, var(--accent) 4%, transparent), transparent)',
      }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: 'var(--text)' }}>
            Also built in
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            The details that make comparing across 9 platforms actually usable.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card
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
            title="Price intelligence"
            body="See low, average, and high prices across all results. Know what the market actually pays before you buy."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M3 17l6-6 4 4 7-8" />
                <path d="M14 7h6v6" />
              </svg>
            }
          />
          <Card
            title="Smart filters"
            body="Filter by platform, size, condition, color, and price range. Narrow to exactly the piece you want, without leaving the page."
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
