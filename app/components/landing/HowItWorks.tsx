const STEPS = [
  {
    n: '01',
    title: 'Check the comp',
    body: 'Search once across 7 platforms to see what buyers are actually paying right now. No tab-switching, no spreadsheets, no guessing.',
  },
  {
    n: '02',
    title: 'Run the margin',
    body: 'Enter your sourcing price and pick the platform you plan to sell on. See net profit after real seller fees before you commit to buying.',
  },
  {
    n: '03',
    title: 'Set a sourcing alert',
    body: 'Save the search with your brand, size, and max-price criteria. Get notified the moment a matching listing hits any platform.',
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
            Your sourcing workflow, built in
          </h2>
          <p
            className="mt-3 text-base sm:text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            From comp check to sourcing alert in under a minute.
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
