import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Crawli',
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-dim)' }}>Last updated: May 2025</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>What we collect</h2>
            <p>When you sign in, we store your email address and a user profile in our database. If you save searches or listings, that data is stored and associated with your account. We do not collect payment card details — payments are processed by Stripe.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>How we use it</h2>
            <p>Your data is used solely to operate Crawli: to authenticate you, show your saved items, and deliver search results. We do not sell your data, share it with advertisers, or use it for any purpose beyond running the service.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Third-party services</h2>
            <p>Crawli uses the following third-party services, each with their own privacy policies:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Supabase — authentication and database</li>
              <li>Stripe — payment processing</li>
              <li>Google — sign-in via Google OAuth</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Cookies</h2>
            <p>We use a session cookie to keep you signed in. No advertising or tracking cookies are set.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Data deletion</h2>
            <p>You can delete your account and all associated data at any time by contacting us. We will process the request within 7 days.</p>
          </section>

          <section>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text)' }}>Contact</h2>
            <p>
              Questions or requests?{' '}
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
