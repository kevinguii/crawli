import Link from 'next/link';

const ITEMS = [
  { slug: 'north-face-nuptse-jacket',      name: 'North Face Nuptse Jacket',     category: 'Outerwear' },
  { slug: 'levis-501-jeans',               name: "Levi's 501 Jeans",             category: 'Denim'     },
  { slug: 'new-balance-550',               name: 'New Balance 550',              category: 'Sneakers'  },
  { slug: 'nike-air-force-1',              name: 'Nike Air Force 1',             category: 'Sneakers'  },
  { slug: 'fear-of-god-essentials-hoodie', name: 'Fear of God Essentials Hoodie',category: 'Hoodies'   },
  { slug: 'carhartt-wip-jacket',           name: 'Carhartt WIP Jacket',          category: 'Outerwear' },
  { slug: 'supreme-box-logo-hoodie',       name: 'Supreme Box Logo Hoodie',      category: 'Hoodies'   },
  { slug: 'jordan-1-retro-high',           name: 'Jordan 1 Retro High',          category: 'Sneakers'  },
  { slug: 'adidas-samba',                  name: 'Adidas Samba',                 category: 'Sneakers'  },
  { slug: 'bape-shark-hoodie',             name: 'BAPE Shark Hoodie',            category: 'Hoodies'   },
  { slug: 'ralph-lauren-polo-shirt',       name: 'Ralph Lauren Polo Shirt',      category: 'Tops'      },
  { slug: 'patagonia-better-sweater',      name: 'Patagonia Better Sweater',     category: 'Outerwear' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Sneakers:  'var(--accent)',
  Hoodies:   '#8B5CF6',
  Outerwear: '#0EA5E9',
  Denim:     '#F59E0B',
  Tops:      '#10B981',
};

export default function CompareSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">

        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--accent-text)' }}
          >
            Live price data
          </p>
          <h2
            className="mt-2 text-2xl font-bold sm:text-3xl"
            style={{ color: 'var(--text)' }}
          >
            Know the real comp before you buy
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Prices cached daily across 8 platforms. Click any item to see where it&apos;s cheapest.
          </p>
        </div>

        {/* Item grid */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <Link
              key={item.slug}
              href={`/compare/${item.slug}`}
              className="group flex flex-col gap-3 rounded-2xl p-4 transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              }}
            >
              {/* Category chip */}
              <span
                className="self-start rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${CATEGORY_COLORS[item.category] ?? 'var(--accent)'} 15%, transparent)`,
                  color: CATEGORY_COLORS[item.category] ?? 'var(--accent)',
                }}
              >
                {item.category}
              </span>

              {/* Name */}
              <p
                className="flex-1 text-sm font-medium leading-snug"
                style={{ color: 'var(--text)' }}
              >
                {item.name}
              </p>

              {/* CTA */}
              <span
                className="text-xs font-medium transition-colors group-hover:opacity-100"
                style={{ color: 'var(--accent)', opacity: 0.7 }}
              >
                See prices →
              </span>
            </Link>
          ))}
        </div>

        {/* View all link */}
        <div className="mt-8 text-center">
          <Link
            href="/compare/nike-air-force-1"
            className="text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Browse more comparisons →
          </Link>
        </div>

      </div>
    </section>
  );
}
