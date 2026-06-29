import Link from 'next/link';

export default function FounderNote() {
  return (
    <section className="px-5 pb-12 sm:px-8">
      <div
        className="mx-auto max-w-2xl rounded-2xl px-8 py-8 text-center"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        <p
          className="text-base italic leading-relaxed sm:text-lg"
          style={{ color: 'var(--text-muted)' }}
        >
          &ldquo;I used to cross-reference 7 tabs, a spreadsheet, and a gut feeling before every buy. Crawli exists so you can know the comp and your margin in seconds, not hours.&rdquo;
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            - Kevin, Founder
          </span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <Link
            href="/blog/why-we-started-crawli"
            className="text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent-text)' }}
          >
            Read the full story →
          </Link>
        </div>
      </div>
    </section>
  );
}
