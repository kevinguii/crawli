import Link from 'next/link';
import CompareHeroWidget from './CompareHeroWidget';
import type { CompareHeroItem } from '@/lib/compare';

const PILLARS = [
  {
    label: 'Cross-platform comp in seconds',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 17l6-6 4 4 7-8" /><path d="M14 7h6v6" />
      </svg>
    ),
  },
  {
    label: 'Alerts the moment deals land',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: 'Net flip profit after fees',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" />
      </svg>
    ),
  },
];

export default function Hero({ heroItems = [] }: { heroItems: CompareHeroItem[] }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(226,75,74,0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 30%, rgba(239,159,39,0.08), transparent 60%)',
        }}
      />
      <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-14 sm:px-8 sm:pt-20 sm:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent-text)',
                border: '1px solid var(--accent-soft)',
              }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              Sourcing intelligence for resellers
            </span>

            <h1
              className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: 'var(--text)', lineHeight: 1.05 }}
            >
              Stop guessing.{' '}
              <span
                style={{
                  background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                See the real price, across every platform.
              </span>
            </h1>

            <p
              className="mx-auto mt-5 max-w-xl text-base sm:text-lg lg:mx-0"
              style={{ color: 'var(--text-muted)' }}
            >
              Search 9 resale platforms at once, see what the market is really paying, and know your net flip profit after fees before you spend a dollar.
            </p>

            {/* Value pillars */}
            <div className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:mx-0 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center lg:justify-start">
              {PILLARS.map(({ icon, label }) => (
                <div key={label} className="flex items-center justify-center gap-2 sm:justify-start">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {icon}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/login?tab=signup"
                className="btn-primary w-full rounded-xl px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                Start sourcing free
              </Link>
              <a
                href="#hero-compare"
                className="w-full rounded-xl px-6 py-3 text-center text-sm font-semibold transition-colors sm:w-auto"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                See it live ↓
              </a>
            </div>

            <p className="mt-4 text-center text-xs lg:text-left" style={{ color: 'var(--text-dim)' }}>
              Free to start · No credit card required
            </p>
          </div>

          {/* Right: live cross-platform comparison */}
          <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <CompareHeroWidget items={heroItems} />
          </div>
        </div>
      </div>
    </section>
  );
}
