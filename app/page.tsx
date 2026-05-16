import SearchSection from './components/SearchSection';
import ThemeToggle from './components/ThemeToggle';

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Top nav */}
      <nav
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-md"
              style={{ background: 'var(--accent)' }}
            />
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Resale<span style={{ color: 'var(--text-muted)' }}>/Search</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            Find the best resale price.
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            One query — live pricing from Grailed, Depop, StockX, Poshmark, Mercari, Vinted, eBay, and Vestiaire.
          </p>
        </div>

        <SearchSection />
      </div>
    </main>
  );
}
