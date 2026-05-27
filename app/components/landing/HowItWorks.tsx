const STEPS = [
  {
    n: '01',
    title: 'Search once',
    body: 'Type what you’re looking for. One query searches every platform at the same time.',
  },
  {
    n: '02',
    title: 'See all results',
    body: 'Listings from 8 resale platforms appear side-by-side, sortable by price, condition, and more.',
  },
  {
    n: '03',
    title: 'Save & track',
    body: 'Heart listings you love. Watchlist anything you want to track for price drops and new arrivals.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            From query to checkout in seconds
          </h2>
          <p
            className="mt-3 text-base sm:text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            Three steps. No tab-switching. No price comparison spreadsheets.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col items-center text-center">
              <span
                className="block text-5xl font-bold tracking-tight sm:text-6xl"
                style={{
                  background:
                    'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  lineHeight: 1,
                }}
              >
                {s.n}
              </span>
              <h3
                className="mt-4 text-xl font-semibold"
                style={{ color: 'var(--text)' }}
              >
                {s.title}
              </h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
