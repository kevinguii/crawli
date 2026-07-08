import FlipCalculator from './FlipCalculator';

export default function MarginSection() {
  return (
    <section id="margin" className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
            Before you buy
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
            Found it. Now know what it&apos;s worth to you.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Enter your sourcing price and where you plan to sell. See net profit,
            margin, and ROI after real seller-side fees before you spend a dollar.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-md">
          <FlipCalculator />
        </div>
      </div>
    </section>
  );
}
