/**
 * Real, attributed user quotes. Two only — both verified, neither edited.
 *
 * Deliberately NOT marked up as Review/AggregateRating schema: Google excludes
 * self-serving reviews (reviews about a business, hosted by that business) from
 * rich-result eligibility on Organization, so schema here would earn nothing and
 * risks a structured-data manual action. Visible social proof only.
 *
 * Both quotes are pure sentiment, so neither asserts a capability that needs a
 * Validated entry in COMPETITIVE_POSITIONING.md §6.
 */
const QUOTES = [
  {
    quote: 'Product’s great, I use it every day.',
    name: 'Jonah K.',
  },
  {
    quote: 'Crawli saves me a bunch of time, makes sourcing and selling so much easier.',
    name: 'Justin H.',
  },
];

export default function Testimonials() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
        {QUOTES.map(({ quote, name }) => (
          <figure
            key={name}
            className="flex flex-col gap-3 rounded-2xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex gap-0.5" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ color: 'var(--accent)' }}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <blockquote
              className="text-sm leading-relaxed sm:text-base"
              style={{ color: 'var(--text)' }}
            >
              “{quote}”
            </blockquote>
            <figcaption className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
              {name}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
