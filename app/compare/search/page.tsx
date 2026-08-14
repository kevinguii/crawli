import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllCompareItems, getCompareTeasers, type CompareItem } from '@/lib/compare';

/**
 * Public search results for the homepage's HeroSearch box.
 *
 * Deliberately a sibling route rather than `/compare?q=`: reading searchParams
 * on /compare would opt that page out of its `revalidate = 3600` ISR and make
 * the main comparison hub dynamic on every request.
 *
 * A static segment wins over `[slug]`, so /compare/search never hits the
 * comparison detail route.
 */

export const metadata: Metadata = {
  title: 'Search resale comparisons',
  // Crawlable but not indexable: the SearchAction target in StructuredData.tsx
  // has to be fetchable for Google and answer-engine agents to verify it works,
  // while arbitrary ?q= permutations must stay out of the index. `follow` keeps
  // the links out to /compare/[slug] flowing.
  robots: { index: false, follow: true },
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mirrors HeroSearch's matcher so a client-side miss is also a server-side miss. */
function findMatches(items: CompareItem[], query: string): CompareItem[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  return items.filter((item) => {
    const hay = normalize(`${item.name} ${item.query} ${item.category ?? ''}`);
    return tokens.every((t) => hay.includes(t));
  });
}

/** Loosest fallback: any item sharing at least one token with the query. */
function findRelated(items: CompareItem[], query: string): CompareItem[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  return items
    .filter((item) => {
      const hay = normalize(`${item.name} ${item.query} ${item.category ?? ''}`);
      return tokens.some((t) => t.length > 2 && hay.includes(t));
    })
    .slice(0, 6);
}

function teaserLabel(min: number | undefined): string {
  if (min === undefined) return 'See prices';
  return `from $${Math.round(min).toLocaleString('en-US')}`;
}

function ResultGrid({
  items,
  teasers,
}: {
  items: CompareItem[];
  teasers: Map<string, number>;
}) {
  return (
    <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.slug}
          className="compare-card group relative flex flex-col gap-2 rounded-2xl p-4 transition-all hover:scale-[1.02]"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
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
        </li>
      ))}
    </ul>
  );
}

export default async function CompareSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim().slice(0, 120);

  const [items, teasers] = await Promise.all([getAllCompareItems(), getCompareTeasers()]);
  const matched = query ? findMatches(items, query) : [];
  const related = matched.length === 0 && query ? findRelated(items, query) : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
      <header className="max-w-3xl">
        <h1
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: 'var(--text)' }}
        >
          {query ? <>Results for “{query}”</> : 'Search resale comparisons'}
        </h1>

        {query && matched.length > 0 && (
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            {matched.length} daily comparison{matched.length === 1 ? '' : 's'} match. Live prices
            across 8 marketplaces, no login needed.
          </p>
        )}

        {query && matched.length === 0 && (
          <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            We do not track a daily comparison for this one yet. Crawli can still search it live
            across all nine marketplaces and show you what the market is really paying.
          </p>
        )}

        {!query && (
          <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Browse every comparison on the{' '}
            <Link
              href="/compare"
              className="font-medium underline underline-offset-2"
              style={{ color: 'var(--accent)' }}
            >
              comparison hub
            </Link>
            , or search any item live across nine marketplaces.
          </p>
        )}
      </header>

      {matched.length > 0 && <ResultGrid items={matched} teasers={teasers} />}

      {query && matched.length === 0 && (
        <div
          className="mt-8 rounded-2xl p-6 sm:p-8"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
            Search “{query}” across Grailed, Depop, Poshmark, StockX, Mercari, Vinted, ThredUp, eBay
            and Vestiaire
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            One search, every marketplace, with net flip profit after fees.
          </p>
          <Link
            href={`/login?tab=signup&q=${encodeURIComponent(query)}`}
            className="btn-primary mt-5 inline-block rounded-xl px-6 py-3 text-sm font-semibold"
          >
            Start comparing free
          </Link>
          <p className="mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
            Free to start · No credit card required
          </p>
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            Closest comparisons we track
          </h2>
          <ResultGrid items={related} teasers={teasers} />
        </section>
      )}

      <p className="mt-16 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link
          href="/compare"
          className="font-medium underline underline-offset-2"
          style={{ color: 'var(--accent)' }}
        >
          See all {items.length} resale price comparisons
        </Link>
      </p>
    </div>
  );
}
