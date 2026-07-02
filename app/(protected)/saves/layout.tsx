export default function SavesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Saves
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Items you&apos;ve hearted. Organize into collections to find them later.
        </p>
      </header>
      {children}
    </div>
  );
}
