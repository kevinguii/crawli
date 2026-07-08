import Link from 'next/link';
import type { CompareItem } from '@/lib/compare';

const CATEGORY_COLORS: Record<string, string> = {
  Sneakers:  'var(--accent)',
  Footwear:  'var(--accent)',
  Hoodies:   '#8B5CF6',
  Outerwear: '#0EA5E9',
  Denim:     '#F59E0B',
  Tops:      '#10B981',
  Bags:      '#EC4899',
};

function teaserLabel(min: number | undefined): string {
  if (min === undefined) return 'See prices →';
  return `from $${Math.round(min).toLocaleString('en-US')} →`;
}

export default function CompareSection({
  items,
  teasers,
  priceGuideSlugs,
}: {
  items: CompareItem[];
  teasers: Map<string, number>;
  priceGuideSlugs: Map<string, string>;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 12);

  return (
    <section id="compare" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
            Real prices · updated daily
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
            See the real comp before you buy
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Live cross-platform pricing on the pieces resellers flip most. Click any item to see where it&apos;s cheapest — no login.
          </p>
        </div>

        {/* Item grid */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const color = (item.category && CATEGORY_COLORS[item.category]) || 'var(--accent)';
            const min = teasers.get(item.slug);
            const blogSlug = priceGuideSlugs.get(item.slug);
            return (
              <div
                key={item.slug}
                className="compare-card group relative flex flex-col gap-3 rounded-2xl p-4 transition-all hover:scale-[1.02]"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {/* Stretched link: the whole card navigates to /compare/[slug]
                    except the "Read analysis" link below, which sits above it
                    (higher z-index) and captures its own clicks. */}
                <Link
                  href={`/compare/${item.slug}`}
                  className="absolute inset-0 z-0 rounded-2xl"
                  aria-label={`See live prices for ${item.name}`}
                />

                {item.category && (
                  <span
                    className="self-start rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      background: `color-mix(in srgb, ${color} 15%, transparent)`,
                      color,
                    }}
                  >
                    {item.category}
                  </span>
                )}

                <p className="flex-1 text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
                  {item.name}
                </p>

                <span
                  className="text-xs font-semibold tabular-nums transition-opacity group-hover:opacity-100"
                  style={{ color: 'var(--accent)', opacity: 0.85 }}
                >
                  {teaserLabel(min)}
                </span>

                {blogSlug && (
                  <Link
                    href={`/blog/${blogSlug}`}
                    className="relative z-10 self-start text-[11px] font-medium underline-offset-2 hover:underline"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    Read analysis →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
