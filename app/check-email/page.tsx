'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthCard from '@/app/components/AuthCard';

function CheckEmailContent() {
  const params = useSearchParams();
  const email = params.get('email');
  const mode = params.get('mode') === 'reset' ? 'reset' : 'signup';

  const heading = mode === 'reset' ? 'Reset link sent' : 'Confirm your email';
  const body =
    mode === 'reset'
      ? 'Click the link in your email to set a new password.'
      : 'Click the link in your email to verify your account and sign in.';

  return (
    <AuthCard>
      <div
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200"
        style={{ background: 'var(--accent-soft)' }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-center mb-2" style={{ color: 'var(--text)' }}>
        {heading}
      </h1>
      <p className="text-sm text-center mb-2" style={{ color: 'var(--text-muted)' }}>
        We sent an email to{' '}
        {email ? (
          <span style={{ color: 'var(--accent-text)', fontWeight: 500 }}>{email}</span>
        ) : (
          'your inbox'
        )}
        .
      </p>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
        {body}
      </p>
      <p className="text-xs text-center mb-6" style={{ color: 'var(--text-dim)' }}>
        Didn&apos;t get it? Check your spam folder, or head back and try again.
      </p>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm font-medium transition-opacity duration-200 hover:opacity-80"
          style={{ color: 'var(--accent-text)' }}
        >
          ← Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}
