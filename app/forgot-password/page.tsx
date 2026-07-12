'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AuthCard from '@/app/components/AuthCard';
import TurnstileWidget, { TURNSTILE_ENABLED, type TurnstileHandle } from '@/app/components/TurnstileWidget';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      captchaToken: captchaToken ?? undefined,
    });
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    router.push(`/check-email?mode=reset&email=${encodeURIComponent(trimmed)}`);
  }

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold text-center mb-1" style={{ color: 'var(--text)' }}>
        Reset your password
      </h1>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

      {error && (
        <div
          className="mb-4 rounded-lg p-3 text-sm transition-all duration-200"
          style={{
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            border: '1px solid var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={loading}
          className="input-base w-full rounded-lg px-4 py-3 text-sm"
        />
        <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />

        <button
          type="submit"
          disabled={loading || !email.trim() || (TURNSTILE_ENABLED && !captchaToken)}
          className="btn-primary w-full rounded-lg px-4 py-3 text-sm font-medium"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-6 text-center">
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
