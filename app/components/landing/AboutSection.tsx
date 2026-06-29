export default function AboutSection() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--accent-text)' }}
        >
          Why Crawli
        </p>
        <h2
          className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: 'var(--text)' }}
        >
          Sourcing shouldn’t take eight tabs and a guess.
        </h2>
        <p
          className="mx-auto mt-5 text-base sm:text-lg"
          style={{ color: 'var(--text-muted)' }}
        >
          Good flips come from buying below the real market, not from luck.
          Crawli pulls every resale marketplace into one search so you see the
          true cross-platform comp, then shows your net margin after each
          platform’s fees before you buy. The sourcing edge every serious
          reseller wishes they had.
        </p>

        <div
          className="mx-auto mt-10 inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl px-6 py-4"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <Stat value="8" label="Platforms" />
          <Divider />
          <Stat value="1" label="Search" />
          <Divider />
          <Stat value="~7s" label="To best price" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-left">
      <div
        className="text-2xl font-bold leading-none"
        style={{
          background:
            'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-[11px] uppercase tracking-wider"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="hidden h-8 w-px sm:inline-block"
      style={{ background: 'var(--border)' }}
    />
  );
}
