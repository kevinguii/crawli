import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllCompareItems,
  getComparePageData,
  hoursAgo,
  cheapestSnapshot,
  type CompareSnapshot,
} from '@/lib/compare';
import { PLATFORM_NAMES } from '@/lib/types';
import type { Listing } from '@/lib/types';

export const revalidate = 3600; // ISR: rebuild hourly from DB

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thecrawli.com';

// Pre-render all enabled slugs at build time
export async function generateStaticParams() {
  const items = await getAllCompareItems();
  return items.map((item) => ({ slug: item.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getComparePageData(slug);
  if (!data) return {};

  const { item } = data;
  const title = `${item.name} Resale Price — Compare Grailed, Depop & 7 More`;
  const description =
    item.description ??
    `Compare ${item.name} resale prices across Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay and Vestiaire. Find the best deal in one search.`;

  return {
    title,
    description,
    alternates: { canonical: `/compare/${slug}` },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}/compare/${slug}`,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$',
};

function fmt(price: number | null): string {
  if (price === null) return '—';
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtLocal(price: number | null, currency: string): string {
  if (price === null) return '—';
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${sym}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Ordered list of native platforms for display
const NATIVE_PLATFORM_ORDER = [
  'grailed', 'depop', 'poshmark', 'mercari', 'vinted',
  'thredup', 'vestiaire', 'stockx',
];

// ── Read-only listing card (no auth hooks — compare page is public) ───────────
function CompareListingCard({ listing }: { listing: Listing }) {
  const [imgFailed, setImgFailed] = ['imgFailed', false] as unknown as [string, boolean];
  const displayPrice = listing.price !== null
    ? fmtLocal(listing.price, listing.currency ?? 'USD')
    : null;

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl transition-all hover:opacity-90 hover:scale-[1.02] cursor-pointer"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        {listing.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs" style={{ color: 'var(--text-dim)' }}>
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-[13px] leading-snug" style={{ color: 'var(--text)' }}>
          {listing.title}
        </p>
        <div className="mt-auto pt-1">
          {displayPrice ? (
            <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              {displayPrice}
            </span>
          ) : (
            <span className="text-xs italic" style={{ color: 'var(--text-dim)' }}>Price unavailable</span>
          )}
        </div>
        {listing.condition && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{listing.condition}</p>
        )}
      </div>
    </a>
  );
}

// ── Platform summary card ─────────────────────────────────────────────────────
function PlatformCard({
  platform,
  snapshot,
  isCheapest,
}: {
  platform: string;
  snapshot: CompareSnapshot | null;
  isCheapest: boolean;
}) {
  const name = PLATFORM_NAMES[platform] ?? platform;
  const hasData = snapshot !== null && snapshot.listing_count !== null;

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-4 transition-all"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isCheapest ? 'var(--success)' : 'var(--border)'}`,
        boxShadow: isCheapest ? '0 0 0 3px var(--success-soft)' : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {name}
        </span>
        {isCheapest && hasData && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: 'var(--success)', color: '#fff' }}
          >
            Lowest
          </span>
        )}
      </div>

      {hasData ? (
        <>
          <div>
            <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              {fmt(snapshot.min_price_usd)}
            </span>
            {snapshot.min_price_usd !== snapshot.max_price_usd && snapshot.max_price_usd !== null && (
              <span className="ml-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                – {fmt(snapshot.max_price_usd)}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {snapshot.listing_count?.toLocaleString()} listing{snapshot.listing_count !== 1 ? 's' : ''}
          </p>
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No listings found</p>
      )}
    </div>
  );
}

// ── eBay live link card ───────────────────────────────────────────────────────
function EbayCard({ query }: { query: string }) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15&LH_BIN=1`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-2 rounded-2xl p-4 transition-all hover:opacity-90"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>eBay</span>
      <p className="text-sm" style={{ color: 'var(--accent)' }}>View live listings →</p>
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Not cached — click to see live</p>
    </a>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default async function ComparePage({ params }: Props) {
  const { slug } = await params;
  const data = await getComparePageData(slug);
  if (!data) notFound();

  const { item, snapshots } = data;

  // Build a quick lookup map
  const snapshotByPlatform = new Map<string, CompareSnapshot>(
    snapshots.map((s) => [s.platform, s]),
  );

  const cheapest = cheapestSnapshot(snapshots);
  const cheapestListings: Listing[] = cheapest?.listings ?? [];

  // Most recent scrape time across all snapshots
  const latestScrape = snapshots.reduce<string | null>((latest, s) => {
    if (!latest) return s.scraped_at;
    return s.scraped_at > latest ? s.scraped_at : latest;
  }, null);

  // JSON-LD: ItemList with one entry per platform that has data
  const offersWithData = snapshots.filter((s) => s.min_price_usd !== null);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE_URL}/compare` },
          { '@type': 'ListItem', position: 3, name: item.name },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${item.name} Resale Prices`,
        description: `Cross-platform resale price comparison for ${item.name} across ${offersWithData.length} marketplaces.`,
        numberOfItems: offersWithData.length,
        itemListElement: offersWithData.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: PLATFORM_NAMES[s.platform] ?? s.platform,
          item: {
            '@type': 'Offer',
            name: `${item.name} on ${PLATFORM_NAMES[s.platform] ?? s.platform}`,
            lowPrice: s.min_price_usd,
            highPrice: s.max_price_usd,
            offerCount: s.listing_count,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        })),
      },
    ],
  };

  const searchUrl = `/login?tab=signup&q=${encodeURIComponent(item.query)}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm" style={{ color: 'var(--text-dim)' }}>
          <Link href="/" className="hover:opacity-80 transition-opacity">Home</Link>
          <span>/</span>
          <span>Price comparison</span>
          <span>/</span>
          <span style={{ color: 'var(--text-muted)' }}>{item.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-10">
          {item.category && (
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {item.category}
            </span>
          )}
          <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text)' }}>
            {item.name}
          </h1>
          <p className="mt-2 text-base" style={{ color: 'var(--text-muted)' }}>
            Resale prices across 8 marketplaces
            {latestScrape && (
              <> · <span style={{ color: 'var(--text-dim)' }}>Updated {hoursAgo(latestScrape)}</span></>
            )}
          </p>
        </div>

        {/* Platform grid */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Price by platform
          </h2>
          {snapshots.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-10 text-center text-sm"
              style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
            >
              Snapshot not yet generated — check back after the next daily refresh (6 AM UTC).
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {NATIVE_PLATFORM_ORDER.map((platform) => (
                <PlatformCard
                  key={platform}
                  platform={platform}
                  snapshot={snapshotByPlatform.get(platform) ?? null}
                  isCheapest={cheapest?.platform === platform}
                />
              ))}
              <EbayCard query={item.query} />
            </div>
          )}
        </section>

        {/* Sample listings from cheapest platform */}
        {cheapestListings.length > 0 && cheapest && (
          <section className="mb-12">
            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Top listings on {PLATFORM_NAMES[cheapest.platform] ?? cheapest.platform}
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-dim)' }}>
                (lowest prices)
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cheapestListings.slice(0, 4).map((listing, i) => (
                <CompareListingCard key={listing.url ?? i} listing={listing} />
              ))}
            </div>
          </section>
        )}

        {/* CTA strip */}
        <div
          className="rounded-2xl px-6 py-8 text-center"
          style={{
            background: 'var(--search-container-bg)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="mb-1 text-xl font-bold" style={{ color: 'var(--text)' }}>
            Search {item.name} live across 9 platforms
          </p>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            See real-time results, set a price alert, and never miss a deal.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={searchUrl}
              className="btn-primary rounded-xl px-6 py-3 text-sm font-semibold"
            >
              Search live — free
            </Link>
            <Link
              href={`/login?tab=signup&alert=${encodeURIComponent(item.query)}`}
              className="btn-filled-grey rounded-xl px-6 py-3 text-sm font-semibold"
            >
              Set a price alert
            </Link>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-dim)' }}>
            Free account · No credit card required
          </p>
        </div>

      </div>
    </>
  );
}
