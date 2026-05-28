import Link from 'next/link';
import Wordmark from './Wordmark';

export default function Footer() {
  return (
    <footer
      className="px-5 py-8 sm:px-8"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <Wordmark size={22} />
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            © 2026 Crawli
          </span>
        </div>

        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/privacy"
            className="transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
