import MockFrame from './MockFrame';

type Alert = {
  query: string;
  platforms: string[];
  newCount: number;
  lastChecked: string;
};

const ALERTS: Alert[] = [
  {
    query: 'stussy world tour hoodie',
    platforms: ['Grailed', 'Depop', 'Vinted'],
    newCount: 4,
    lastChecked: '12m ago',
  },
  {
    query: 'maison margiela tabi 39',
    platforms: ['Grailed', 'Vestiaire'],
    newCount: 1,
    lastChecked: '1h ago',
  },
  {
    query: 'arcteryx beta ar medium',
    platforms: ['Grailed', 'eBay', 'Poshmark'],
    newCount: 0,
    lastChecked: '3h ago',
  },
];

export default function AlertsMock() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--accent-text)' }}
          >
            Be the first to know
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            Save a search. Get alerts when new listings appear.
          </h2>
          <p
            className="mt-3 text-base"
            style={{ color: 'var(--text-muted)' }}
          >
            Crawli rechecks your saved searches every day and pings you the
            moment a matching listing hits any platform.
          </p>
        </div>

        <div className="mt-12">
          <MockFrame url="thecrawli.com/alerts">
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {ALERTS.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  style={{
                    borderTop:
                      i === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {a.newCount > 0 ? (
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: 'var(--accent)' }}
                      >
                        {a.newCount}
                      </span>
                    ) : (
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: 'var(--surface)',
                          color: 'var(--text-dim)',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </span>
                    )}
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--text)' }}
                      >
                        {a.query}
                      </p>
                      <p
                        className="mt-0.5 truncate text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {a.platforms.join(' · ')} · checked {a.lastChecked}
                      </p>
                    </div>
                  </div>
                  <span
                    className="hidden flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium sm:inline-block"
                    style={{
                      background:
                        a.newCount > 0 ? 'var(--accent-soft)' : 'var(--surface)',
                      color:
                        a.newCount > 0
                          ? 'var(--accent-text)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {a.newCount > 0
                      ? `${a.newCount} new`
                      : 'No new matches'}
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between gap-3 px-5 py-3"
                style={{
                  borderTop: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Daily auto-check · Pro: 3 alerts · Max: 10 alerts
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  + New alert
                </button>
              </div>
            </div>
          </MockFrame>
        </div>
      </div>
    </section>
  );
}
