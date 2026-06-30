import Link from 'next/link';
import Wordmark from './Wordmark';

// These profiles are crawlable and corroborate the Organization `sameAs` in
// StructuredData.tsx (entity consolidation / brand-rank signal).
const SOCIALS: { label: string; href: string; cls: string; icon: React.ReactNode }[] = [
  {
    label: 'Crawli on X',
    href: 'https://x.com/thecrawli',
    cls: 'social-icon social-x',
    icon: (
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    ),
  },
  {
    label: 'Crawli on TikTok',
    href: 'https://www.tiktok.com/@thecrawli',
    cls: 'social-icon social-tiktok',
    icon: (
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
    ),
  },
  {
    label: 'Crawli on Instagram',
    href: 'https://www.instagram.com/thecrawli/',
    cls: 'social-icon social-instagram',
    icon: (
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.94c-3.14 0-3.51.01-4.75.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.04-.9-.19-1.39-.32-1.71a2.85 2.85 0 0 0-.69-1.06 2.85 2.85 0 0 0-1.06-.69c-.32-.13-.81-.28-1.71-.32-1.24-.06-1.61-.07-4.75-.07Zm0 3.3a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 7.59a2.99 2.99 0 1 0 0-5.98 2.99 2.99 0 0 0 0 5.98Zm5.86-7.81a1.08 1.08 0 1 1-2.15 0 1.08 1.08 0 0 1 2.15 0Z" />
    ),
  },
  {
    label: 'Crawli on Pinterest',
    href: 'https://www.pinterest.com/thecrawli/',
    cls: 'social-icon social-pinterest',
    icon: (
      <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.22 2.62 7.82 6.32 9.27-.09-.79-.17-2 .03-2.86.18-.78 1.18-4.97 1.18-4.97s-.3-.6-.3-1.49c0-1.4.81-2.44 1.82-2.44.86 0 1.27.64 1.27 1.42 0 .86-.55 2.15-.83 3.34-.24 1 .5 1.81 1.48 1.81 1.78 0 3.14-1.87 3.14-4.57 0-2.39-1.72-4.06-4.17-4.06-2.84 0-4.51 2.13-4.51 4.33 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.33-.25 1-.28 1.14-.05.18-.15.22-.34.13-1.27-.59-2.06-2.44-2.06-3.93 0-3.2 2.33-6.14 6.71-6.14 3.52 0 6.26 2.51 6.26 5.86 0 3.5-2.21 6.32-5.27 6.32-1.03 0-2-.54-2.33-1.17l-.63 2.42c-.23.88-.85 1.98-1.27 2.65.95.29 1.96.45 3.01.45 5.5 0 9.96-4.46 9.96-9.96 0-5.5-4.46-9.96-9.96-9.96Z" />
    ),
  },
];

export default function Footer() {
  return (
    <footer className="site-footer px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-7 sm:flex-row sm:justify-between">

        {/* Brand */}
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <Wordmark size={24} />
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            © 2026 Crawli
          </span>
        </div>

        {/* Social icons */}
        <div className="flex items-center gap-6">
          {SOCIALS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="me noopener noreferrer"
              aria-label={s.label}
              className={s.cls}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {s.icon}
              </svg>
            </a>
          ))}
        </div>

        {/* Nav links — Blog lives in the navbar */}
        <nav className="flex items-center gap-5 text-sm">
          {[
            { href: '/privacy', label: 'Privacy' },
            { href: '/terms', label: 'Terms' },
            { href: '/contact', label: 'Contact' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="transition-opacity hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
            >
              {label}
            </Link>
          ))}
        </nav>

      </div>
    </footer>
  );
}
