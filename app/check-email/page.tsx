'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AuthCard, { GoogleIcon } from '@/app/components/AuthCard';
import TurnstileWidget, { TURNSTILE_ENABLED, type TurnstileHandle } from '@/app/components/TurnstileWidget';

// Supabase enforces a per-user resend cooldown (default 60s). Match it here so
// the button doesn't let users fire a request that silently no-ops server-side.
const RESEND_COOLDOWN_SECONDS = 60;

function CheckEmailContent() {
  const params = useSearchParams();
  const email = params.get('email');
  const mode = params.get('mode') === 'reset' ? 'reset' : 'signup';
  // Set when signup returned identities:[]. The email already has an account.
  // Supabase's resend() no-ops silently for confirmed accounts (still 200), so
  // we can't tell "unconfirmed, resent" from "confirmed, e.g. Google-only" apart.
  // Show both paths instead of guessing.
  const existing = params.get('existing') === '1';

  const [googleLoading, setGoogleLoading] = useState(false);

  const heading = existing ? 'Check your email' : mode === 'reset' ? 'Reset link sent' : 'Confirm your email';
  const body = existing
    ? "If this is a new signup, we've sent a confirmation link. If you already have an account with this email, sign in instead. You may have originally signed up with Google."
    : mode === 'reset'
      ? 'Click the link in your email to set a new password.'
      : 'Click the link in your email to verify your account and sign in.';

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setGoogleLoading(false);
  }, []);

  // Start with the cooldown running: an email was just sent by the page that
  // redirected here, so an immediate resend would be a no-op anyway.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0 || status === 'sending') return;
    if (TURNSTILE_ENABLED && !captchaToken) return;
    setStatus('sending');
    const supabase = createClient();
    const token = captchaToken ?? undefined;
    const { error } =
      mode === 'reset'
        ? await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
            captchaToken: token,
          })
        : await supabase.auth.resend({ type: 'signup', email, options: { captchaToken: token } });
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    if (error) {
      setStatus('error');
    } else {
      setStatus('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }, [email, cooldown, status, mode, captchaToken]);

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
      {!existing && (
        <p className="text-sm text-center mb-2" style={{ color: 'var(--text-muted)' }}>
          We sent an email to{' '}
          {email ? (
            <span style={{ color: 'var(--accent-text)', fontWeight: 500 }}>{email}</span>
          ) : (
            'your inbox'
          )}
          .
        </p>
      )}
      <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
        {body}
      </p>
      {!existing && (
        <p className="text-xs text-center mb-6" style={{ color: 'var(--text-dim)' }}>
          It can take a minute to arrive. Check your spam and Promotions folders before resending.
        </p>
      )}

      {existing && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="btn-secondary w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium mb-3"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <div className="flex items-center justify-center gap-3 text-sm">
            <Link
              href="/login"
              className="font-medium transition-opacity duration-200 hover:opacity-80"
              style={{ color: 'var(--accent-text)' }}
            >
              Sign in with a password
            </Link>
            <span style={{ color: 'var(--text-dim)' }}>·</span>
            <Link
              href="/forgot-password"
              className="font-medium transition-opacity duration-200 hover:opacity-80"
              style={{ color: 'var(--accent-text)' }}
            >
              Forgot password?
            </Link>
          </div>
        </div>
      )}

      {email && (
        <div className="mb-6 text-center">
          {existing && (
            <p className="mb-2 text-xs" style={{ color: 'var(--text-dim)' }}>
              New here and nothing arrived?
            </p>
          )}
          {cooldown <= 0 && <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || status === 'sending' || (TURNSTILE_ENABLED && !captchaToken)}
            className="text-sm font-medium transition-opacity duration-200 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: 'var(--accent-text)' }}
          >
            {status === 'sending'
              ? 'Sending…'
              : cooldown > 0
                ? `Resend ${mode === 'reset' ? 'reset link' : 'confirmation email'} (${cooldown}s)`
                : `Resend ${mode === 'reset' ? 'reset link' : 'confirmation email'}`}
          </button>
          {status === 'sent' && (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Sent again. Give it a minute.
            </p>
          )}
          {status === 'error' && (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Couldn&apos;t resend just now. Wait a moment and try again.
            </p>
          )}
        </div>
      )}

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
