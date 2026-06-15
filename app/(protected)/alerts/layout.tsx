import Link from 'next/link';
import AuthButton from '@/app/components/AuthButton';
import Wordmark from '@/app/components/landing/Wordmark';

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <nav
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          borderBottom: '1px solid rgba(226, 75, 74, 0.22)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/search" className="flex items-center">
            <Wordmark size={30} />
          </Link>
          <div className="flex items-center gap-3">
            <AuthButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Alerts
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            Track listings and get notified when new matches appear.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}
