export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Watchlist
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Listings you&apos;re tracking. Refresh prices to see what&apos;s changed.
        </p>
      </header>
      {children}
    </div>
  );
}
