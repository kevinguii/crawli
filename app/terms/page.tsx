import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Crawli',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-16" style={{ background: 'var(--bg)' }}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Close"
          className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </Link>
      </div>

      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text)' }}>
          Terms of Service
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-dim)' }}>Last updated: May 2025</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>What Crawli is</h2>
            <p>Crawli is a search tool that aggregates publicly available listings from resale platforms. We do not sell items, guarantee listing accuracy, or have any affiliation with the platforms we index.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Your account</h2>
            <p>You are responsible for keeping your account credentials secure. You must be at least 13 years old to use Crawli. One account per person — don't share or transfer accounts.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Acceptable use</h2>
            <p>Use Crawli for personal, non-commercial search only. Do not attempt to scrape, reverse-engineer, or automate requests beyond normal usage. Do not use Crawli to facilitate fraud or any illegal activity.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Subscriptions and billing</h2>
            <p>Pro subscriptions are billed monthly through Stripe. You can cancel at any time; your access continues until the end of the billing period. We do not offer refunds for partial periods, but contact us if something went wrong and we&apos;ll sort it out.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Disclaimer</h2>
            <p>Crawli is provided as-is. We make no guarantees about uptime, listing accuracy, or availability of results from any platform. We are not liable for any losses arising from use of the service.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Changes</h2>
            <p>We may update these terms occasionally. Continued use of Crawli after changes are posted means you accept the new terms.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Contact</h2>
            <p>
              Questions?{' '}
              <a
                href="mailto:hello@thecrawli.com"
                className="underline underline-offset-2"
                style={{ color: 'var(--text)' }}
              >
                hello@thecrawli.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
