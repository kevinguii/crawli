import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllCompareItems, getCompareTeasers, type CompareItem } from '@/lib/compare';
import { getPriceGuideSlugMap } from '@/lib/blog';

export const revalidate = 3600; // ISR: rebuild hourly, same cadence as /compare/[slug]

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thecrawli.com';

export const metadata: Metadata = {
  // Renders as "Resale Price Comparisons · Crawli" (37 chars) via the
  // root layout's "%s · Crawli" template, well inside Bing's ~60-char cut.
  title: 'Resale Price Comparisons',
  description:
    'Live resale price ranges for 33 of the most-searched secondhand pieces, compared across Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay and Vestiaire. Updated daily.',
  alternates: { canonical: '/compare' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/compare`,
    title: 'Resale Price Comparisons',
    description:
      'Live resale price ranges for 33 of the most-searched secondhand pieces, compared across 8 marketplaces. Updated daily.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resale Price Comparisons',
    description:
      'Live resale price ranges for 33 of the most-searched secondhand pieces, compared across 8 marketplaces. Updated daily.',
  },
};

// `compare_items.category` is stored lowercase-kebab in Supabase. These are the
// display labels and the section order on this page: anything not listed here
// still renders, appended at the end under its raw slug title-cased.
const CATEGORY_META: { key: string; label: string; blurb: string }[] = [
  {
    key: 'luxury-handbags',
    label: 'Luxury handbags',
    blurb: 'The widest spreads on the site. Condition, hardware, and full sets move these prices by thousands.',
  },
  {
    key: 'luxury-watches',
    label: 'Luxury watches',
    blurb: 'Reference, case material, and box-and-papers drive the range far more than age does.',
  },
  {
    key: 'luxury-jewelry',
    label: 'Luxury jewelry',
    blurb: 'Size and metal decide the tier. Anything priced far under the range is not the real piece.',
  },
  {
    key: 'luxury-accessories',
    label: 'Luxury accessories',
    blurb: 'Small leather goods and silk, where curated platforms and peer-to-peer diverge most.',
  },
  {
    key: 'sneakers',
    label: 'Sneakers',
    blurb: 'Size runs and colorway demand split the same shoe across a surprisingly wide band.',
  },
  {
    key: 'hoodies',
    label: 'Hoodies & sweats',
    blurb: 'Where counterfeits are thickest and the cheapest listing is least often the best buy.',
  },
  {
    key: 'outerwear',
    label: 'Outerwear',
    blurb: 'Seasonal pricing. The same jacket costs meaningfully less out of season.',
  },
  {
    key: 'denim',
    label: 'Denim',
    blurb: 'Era, fit, and selvedge details separate a $40 pair from a $400 pair.',
  },
  {
    key: 'tops',
    label: 'Tops & tees',
    blurb: 'Graphic rarity does almost all the work here. Blanks and reprints sit at the floor.',
  },
];

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function teaserLabel(min: number | undefined): string {
  if (min === undefined) return 'See prices';
  return `from $${Math.round(min).toLocaleString('en-US')}`;
}

/** Groups items into CATEGORY_META order, appending any unknown categories last. */
function groupByCategory(
  items: CompareItem[],
): { key: string; label: string; blurb: string; items: CompareItem[] }[] {
  const byKey = new Map<string, CompareItem[]>();
  for (const item of items) {
    const key = item.category ?? 'other';
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }

  const ordered = CATEGORY_META.filter((c) => byKey.has(c.key)).map((c) => ({
    ...c,
    items: byKey.get(c.key)!,
  }));

  const knownKeys = new Set(CATEGORY_META.map((c) => c.key));
  for (const [key, list] of byKey) {
    if (knownKeys.has(key)) continue;
    ordered.push({ key, label: titleCase(key), blurb: '', items: list });
  }

  return ordered;
}

export default async function ComparePage() {
  const [items, teasers] = await Promise.all([getAllCompareItems(), getCompareTeasers()]);
  const priceGuideSlugs = getPriceGuideSlugMap();
  const groups = groupByCategory(items);

  // ItemList of every comparison, so the hub is legible to crawlers and AI
  // answer engines as a directory rather than a wall of links.
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Resale price comparisons',
    description: `Live cross-marketplace resale price ranges for ${items.length} secondhand pieces.`,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${item.name} resale price`,
      url: `${SITE_URL}/compare/${item.slug}`,
    })),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <header className="max-w-3xl">
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--accent-text)' }}
        >
          Real prices · updated daily
        </p>
        <h1
          className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: 'var(--text)' }}
        >
          Resale price comparisons
        </h1>
        <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          The same piece rarely costs the same on two marketplaces. Every page below shows the live
          asking-price range for one item across Grailed, Depop, Poshmark, StockX, Mercari, Vinted,
          eBay and Vestiaire, rebuilt daily from real listings. No login needed.
        </p>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-dim)' }}>
          {items.length} comparisons across {groups.length} categories.
        </p>
      </header>

      {groups.map((group) => (
        <section key={group.key} className="mt-14 scroll-mt-20" id={group.key}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            {group.label}
          </h2>
          {group.blurb && (
            <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>
              {group.blurb}
            </p>
          )}

          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const blogSlug = priceGuideSlugs.get(item.slug);
              return (
                <li
                  key={item.slug}
                  className="compare-card group relative flex flex-col gap-2 rounded-2xl p-4 transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {/* Stretched link: the whole card navigates to the comparison,
                      except the guide link below, which sits above it (z-10). */}
                  <Link
                    href={`/compare/${item.slug}`}
                    className="absolute inset-0 z-0 rounded-2xl"
                    aria-label={`See live ${item.name} resale prices`}
                  />

                  <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
                    {item.name} resale price
                  </p>

                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: 'var(--accent)', opacity: 0.85 }}
                  >
                    {teaserLabel(teasers.get(item.slug))}
                  </span>

                  {blogSlug && (
                    <Link
                      href={`/blog/${blogSlug}`}
                      className="relative z-10 mt-auto self-start pt-1 text-[11px] font-medium underline-offset-2 hover:underline"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      Buying guide →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="mt-16 text-sm" style={{ color: 'var(--text-muted)' }}>
        Looking for something not listed here?{' '}
        <Link href="/" className="font-medium underline underline-offset-2" style={{ color: 'var(--accent)' }}>
          Search any item across all nine marketplaces
        </Link>
        .
      </p>
    </div>
  );
}
