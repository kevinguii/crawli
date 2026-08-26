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
import { getPriceGuideSlugMap } from '@/lib/blog';

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

/**
 * Typical asking-price band across platforms, for the meta description.
 *
 * Deliberately built from PER-PLATFORM AVERAGES, then trimmed, rather than the
 * raw global `min_price_usd`/`max_price_usd`. The snapshots still carry the
 * residual outliers documented in HANDOFF.md "Compare-page floors": a $29
 * "Cartier Love Bracelet" on Depop, a $5 "Ralph Lauren Polo Shirt" on Vinted,
 * a $72,530 Grailed ask on the same bracelet. Those are exactly the numbers a
 * naive min/max would hand to Google as the headline price, so they must not
 * reach a snippet. Averaging per platform absorbs single junk listings, and
 * dropping the cheapest and priciest platform absorbs a wholly junk platform.
 */
function typicalPriceBand(
  snapshots: CompareSnapshot[],
): { low: number; high: number } | null {
  const avgs = snapshots
    .map((s) => s.avg_price_usd)
    .filter((p): p is number => p !== null && p > 0)
    .sort((a, b) => a - b);
  if (avgs.length === 0) return null;

  // Only trim when there are enough platforms that losing two still leaves a
  // real band. Below 4, there is nothing safe to drop.
  const band = avgs.length >= 4 ? avgs.slice(1, -1) : avgs;
  return { low: Math.round(band[0]), high: Math.round(band[band.length - 1]) };
}

// Root layout applies `template: "%s · Crawli"`, so the rendered <title> is
// always 9 chars longer than what we return here. Bing truncates around 60.
const TITLE_BUDGET = 60 - ' · Crawli'.length;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getComparePageData(slug);
  if (!data) return {};

  const { item, snapshots } = data;

  const stocked = snapshots.filter((s) => (s.listing_count ?? 0) > 0);
  const platformCount = stocked.length;
  const totalListings = stocked.reduce((n, s) => n + (s.listing_count ?? 0), 0);
  const band = typicalPriceBand(stocked);

  // Longest variant that still fits the budget once "· Crawli" is appended.
  // The plain name is always the last resort, so this can never return
  // undefined even for the longest item names.
  const title =
    [
      platformCount > 0
        ? `${item.name} Resale Price: ${platformCount} Sites Compared`
        : null,
      platformCount > 0
        ? `${item.name} Resale Price, ${platformCount} Sites`
        : null,
      `${item.name} Resale Price`,
    ].find((t): t is string => t !== null && t.length <= TITLE_BUDGET) ??
    `${item.name} Resale Price`;

  // "Asking price" is load-bearing: these snapshots are live listings, not
  // completed sales. Sold data is a separate surface (/price-check) and covers
  // only Grailed and Poshmark. See HANDOFF.md.
  const description =
    band && totalListings > 0
      ? `${totalListings} live ${item.name} listings across ${platformCount} marketplaces, typical asking price $${band.low.toLocaleString('en-US')} to $${band.high.toLocaleString('en-US')}. Compare prices and find the cheapest in one search.`
      : item.description ??
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
  if (price === null) return '-';
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtLocal(price: number | null, currency: string): string {
  if (price === null) return '-';
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${sym}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Grammatical comma list: ["A"] → "A", ["A","B"] → "A and B",
// ["A","B","C"] → "A, B, and C". Used for the data-driven FAQ answers.
function formatList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// Ordered list of native platforms for display
const NATIVE_PLATFORM_ORDER = [
  'grailed', 'depop', 'poshmark', 'mercari', 'vinted',
  'thredup', 'vestiaire', 'stockx',
];

// ── Read-only listing card (no auth hooks, compare page is public) ───────────
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
                - {fmt(snapshot.max_price_usd)}
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default async function ComparePage({ params }: Props) {
  const { slug } = await params;
  const data = await getComparePageData(slug);
  if (!data) notFound();

  const { item, snapshots } = data;
  const blogSlug = getPriceGuideSlugMap().get(item.slug);

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

  // JSON-LD: Product with an AggregateOffer per platform. This is the schema
  // Google actually keys its price-range rich result off of (ItemList/ListItem>Offer
  // does not render as a product snippet, only as a list/carousel result).
  const offersWithData = snapshots.filter((s) => s.min_price_usd !== null);
  const allLows = offersWithData.map((s) => s.min_price_usd as number);
  const allHighs = offersWithData.map((s) => s.max_price_usd ?? (s.min_price_usd as number));
  const totalOfferCount = offersWithData.reduce((sum, s) => sum + (s.listing_count ?? 0), 0);

  // Data-driven FAQ. Answers are computed from the same live snapshot the page
  // renders, so the visible text below and the FAQPage JSON-LD stay identical
  // (Google requires the structured FAQ to mirror on-page text). Built only when
  // there is price data. An empty snapshot renders neither the block nor schema.
  const lowPrice = offersWithData.length > 0 ? Math.min(...allLows) : 0;
  const highPrice = offersWithData.length > 0 ? Math.max(...allHighs) : 0;
  const marketCount = offersWithData.length;
  const cheapestName = cheapest
    ? PLATFORM_NAMES[cheapest.platform] ?? cheapest.platform
    : 'an unlisted platform';
  const cheapestMinStr = cheapest ? fmt(cheapest.min_price_usd) : fmt(lowPrice);
  const platformList = formatList(
    offersWithData.map((s) => PLATFORM_NAMES[s.platform] ?? s.platform),
  );
  const priceSpread = highPrice - lowPrice;

  const faqItems: { q: string; a: string }[] =
    offersWithData.length > 0
      ? [
          {
            q: `How much does a ${item.name} cost secondhand?`,
            a: `Secondhand ${item.name} listings currently range from ${fmt(lowPrice)} to ${fmt(highPrice)}, based on ${totalOfferCount.toLocaleString()} live listings across ${marketCount} marketplace${marketCount === 1 ? '' : 's'}. Where a specific listing falls in that range depends mostly on condition, size, and which platform it is on.`,
          },
          {
            q: `Where is the cheapest place to buy a ${item.name}?`,
            a: `Right now the lowest ${item.name} price is on ${cheapestName}, with listings starting around ${cheapestMinStr}. The cheapest platform shifts as inventory turns over, so comparing all ${marketCount} marketplace${marketCount === 1 ? '' : 's'} at once is the reliable way to find the current floor.`,
          },
          {
            q: `Which marketplaces sell the ${item.name} secondhand?`,
            a: `The ${item.name} is currently listed on ${platformList}. Prices, fees, and authentication differ across these platforms, so the same piece can cost noticeably more on one than on another.`,
          },
          {
            q: `Is buying a ${item.name} secondhand worth it?`,
            a:
              priceSpread > 0
                ? `For most buyers, yes. The same ${item.name} spans about ${fmt(priceSpread)} between the lowest and highest listings right now, so checking every marketplace before buying is the difference between paying the low and the high end of that range.`
                : `For most buyers, yes. Prices vary by platform, seller, and condition, so checking every marketplace before buying is the reliable way to avoid overpaying.`,
          },
        ]
      : [];

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
      offersWithData.length > 0
        ? {
            '@type': 'Product',
            name: item.name,
            description: `Cross-platform resale price comparison for ${item.name} across ${offersWithData.length} marketplaces.`,
            ...(item.category ? { category: item.category } : {}),
            // datePublished/dateModified give AI crawlers a machine-readable
            // freshness signal. The page already shows "Updated Xh ago" to
            // users via latestScrape, but that string alone isn't parsed as a
            // date. publisher stands in for author: this is live scraped
            // market data, not an authored opinion piece, so an Organization
            // credit is accurate where a Person byline would not be.
            datePublished: item.created_at,
            ...(latestScrape ? { dateModified: latestScrape } : {}),
            // Inlined rather than an `@id` reference to /#organization. That
            // entity is only declared in the landing page's JSON-LD graph, and
            // this page's structured data must resolve standalone.
            publisher: { '@type': 'Organization', name: 'Crawli', url: SITE_URL },
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'USD',
              lowPrice: Math.min(...allLows),
              highPrice: Math.max(...allHighs),
              offerCount: totalOfferCount,
              // No per-offer `name` here: schema.org doesn't require one, and
              // repeating the full item name once per platform (8x) was the
              // main driver behind a "keyword stuffing" flag from GEO audits.
              // The platform's identity is already conveyed by its position
              // in the offers array plus the surrounding page structure.
              offers: offersWithData.map((s) => ({
                '@type': 'Offer',
                url: `${SITE_URL}/compare/${item.slug}`,
                lowPrice: s.min_price_usd,
                highPrice: s.max_price_usd,
                offerCount: s.listing_count,
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
                itemCondition: 'https://schema.org/UsedCondition',
              })),
            },
          }
        : null,
      faqItems.length > 0
        ? {
            '@type': 'FAQPage',
            mainEntity: faqItems.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }
        : null,
    ].filter(Boolean),
  };

  const searchUrl = `/login?tab=signup&q=${encodeURIComponent(item.query)}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">

        {/* Breadcrumb: links back into the landing compare grid for a seamless loop */}
        <nav className="mb-6 flex items-center gap-2 text-sm" style={{ color: 'var(--text-dim)' }}>
          <Link href="/" className="transition-opacity hover:opacity-80">Home</Link>
          <span>/</span>
          <Link href="/#compare" className="transition-opacity hover:opacity-80" style={{ color: 'var(--accent-text)' }}>
            All comparisons
          </Link>
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
          {offersWithData.length > 0 && (
            <p className="mt-3 max-w-2xl text-base" style={{ color: 'var(--text)' }}>
              {item.name} resale prices currently range from {fmt(Math.min(...allLows))} to{' '}
              {fmt(Math.max(...allHighs))} across {offersWithData.length} marketplaces, based on{' '}
              {totalOfferCount} live listings. The lowest price right now is on{' '}
              {(cheapest && (PLATFORM_NAMES[cheapest.platform] ?? cheapest.platform)) ?? 'an unlisted platform'}.
            </p>
          )}
          {blogSlug && (
            <Link
              href={`/blog/${blogSlug}`}
              className="mt-3 inline-block text-sm font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--accent-text)' }}
            >
              Read the full price analysis →
            </Link>
          )}
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
              Snapshot not yet generated. Check back after the next daily refresh (6 AM UTC).
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

        {/* FAQ: data-driven, mirrors the FAQPage JSON-LD above. Plain server-
            rendered Q&A (no JS gating) so AI answer engines can extract it. */}
        {faqItems.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Frequently asked questions
            </h2>
            <div className="flex flex-col gap-5">
              {faqItems.map((f) => (
                <div key={f.q}>
                  <h3 className="mb-1.5 text-base font-semibold" style={{ color: 'var(--text)' }}>
                    {f.q}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {f.a}
                  </p>
                </div>
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
              Search live for free
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
