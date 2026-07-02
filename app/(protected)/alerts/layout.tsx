export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Alerts
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Track listings and get notified when new matches appear.
        </p>
      </header>
      {children}
    </div>
  );
}
