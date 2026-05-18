import Link from 'next/link';
import ThemeToggle from '@/app/components/ThemeToggle';
import AuthButton from '@/app/components/AuthButton';

export default function SettingsPage() {
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
          <Link href="/" className="flex items-center">
            <span
              style={{
                fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                background:
                  'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.2,
              }}
            >
              Crawli
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          Settings
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Manage your preferences and account.
        </p>

        <div
          className="mt-8 rounded-2xl px-6 py-16 text-center"
          style={{ border: '1px dashed var(--border)' }}
        >
          <div className="mb-3 text-3xl">⚙️</div>
          <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
            Coming soon
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Theme, display name, and email preferences will live here.
          </p>
        </div>
      </div>
    </main>
  );
}
