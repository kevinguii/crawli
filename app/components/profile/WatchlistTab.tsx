export default function WatchlistTab() {
  return (
    <div
      className="rounded-2xl px-6 py-16 text-center"
      style={{ border: '1px dashed var(--border)' }}
    >
      <div className="text-3xl mb-3">👁️</div>
      <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
        Coming next
      </p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        Automatic price monitoring on login — track listings, get notified on drops.
      </p>
    </div>
  );
}
