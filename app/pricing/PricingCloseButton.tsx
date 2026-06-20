import Link from 'next/link';

// Only allow a single leading "/" (reject "//evil.com" protocol-relative
// URLs and absolute "http(s)://" URLs) so `from` can't be used to redirect
// off-site.
function safeInternalPath(from: string | undefined): string {
  if (!from) return '/';
  if (!from.startsWith('/') || from.startsWith('//')) return '/';
  return from;
}

export default function PricingCloseButton({ from }: { from?: string }) {
  const destination = safeInternalPath(from);

  return (
    <Link
      href={destination}
      aria-label="Close"
      className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
      style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    </Link>
  );
}
