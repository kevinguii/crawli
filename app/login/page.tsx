'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AuthCard, { GoogleIcon, EyeIcon, EyeOffIcon } from '@/app/components/AuthCard';

type Tab = 'signin' | 'signup';

function LoginContent() {
  const params = useSearchParams();
  const initialTab: Tab = params.get('tab') === 'signup' ? 'signup' : 'signin';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'submit' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Already signed in? Don't show the auth form — bounce to the app. This makes
  // the public "Get started" / "Create free account" CTAs behave correctly for
  // logged-in users (briefly land here, then auto-redirect to /search).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/search');
    });
  }, [router]);

  const callbackFailed = params.get('error') === 'callback_failed';
  const resetExpired = params.get('error') === 'reset_expired';
  const linkExpired = params.get('error') === 'link_expired';
  const sessionExpired = params.get('error') === 'session_expired';

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;
    setLoading('submit');
    setError(null);

    const supabase = createClient();

    if (tab === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setLoading(null);
        setError(error.message);
        return;
      }
      router.push('/search');
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setLoading(null);
        setError(error.message);
        return;
      }
      // Supabase returns identities:[] for both confirmed accounts and unconfirmed
      // (e.g. expired confirmation link). Try resending confirmation first — if it
      // succeeds the account was unconfirmed and they'll get a fresh link. If it
      // errors the account is already confirmed and they should just log in.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: trimmedEmail,
        });
        setLoading(null);
        if (!resendError) {
          router.push(`/check-email?mode=signup&email=${encodeURIComponent(trimmedEmail)}`);
        } else {
          setError('This email is already registered. Try logging in instead.');
        }
        return;
      }
      router.push(`/check-email?mode=signup&email=${encodeURIComponent(trimmedEmail)}`);
    }
  }

  async function handleGoogle() {
    setLoading('google');
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setLoading(null);
      setError(error.message);
    }
  }

  const banner =
    error ??
    (sessionExpired && 'Your session expired. Please sign in again.') ??
    (linkExpired && 'Your confirmation link expired. Sign up again with the same email to get a new one.') ??
    (callbackFailed && "We couldn't complete sign-in. Please try again.") ??
    (resetExpired && 'Your password-reset link expired. Please request a new one.') ??
    null;

  const submitLabel = tab === 'signin' ? 'Log in' : 'Create account';
  const submitLoadingLabel = tab === 'signin' ? 'Logging in…' : 'Creating account…';

  return (
    <AuthCard>
      <h1
        className="text-xl font-semibold text-center mb-1"
        style={{ color: 'var(--text)' }}
      >
        Welcome to Crawli
      </h1>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
        Log in to save searches and track listings.
      </p>

      {/* Tabs */}
      <div
        className="relative flex p-1 rounded-lg mb-6"
        style={{ background: 'var(--surface)' }}
      >
        <div
          aria-hidden
          className="absolute rounded-md transition-transform duration-200 ease-out"
          style={{
            top: '4px',
            bottom: '4px',
            left: '4px',
            width: 'calc(50% - 4px)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
            transform: tab === 'signin' ? 'translateX(0)' : 'translateX(100%)',
          }}
        />
        <button
          type="button"
          onClick={() => switchTab('signin')}
          className="relative z-10 flex-1 py-2 text-sm font-medium transition-colors duration-200"
          style={{ color: tab === 'signin' ? 'var(--text)' : 'var(--text-muted)' }}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => switchTab('signup')}
          className="relative z-10 flex-1 py-2 text-sm font-medium transition-colors duration-200"
          style={{ color: tab === 'signup' ? 'var(--text)' : 'var(--text-muted)' }}
        >
          Sign up
        </button>
      </div>

      {banner && (
        <div
          className="mb-4 rounded-lg p-3 text-sm transition-all duration-200"
          style={{
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            border: '1px solid var(--danger)',
          }}
        >
          {banner}
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
          disabled={loading !== null}
          className="input-base w-full rounded-lg px-4 py-3 text-sm"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            placeholder="•••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            disabled={loading !== null}
            className="input-base w-full rounded-lg px-4 py-3 pr-11 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-200"
            style={{ color: 'var(--text-muted)', opacity: 0.7 }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {tab === 'signin' && (
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs transition-opacity duration-200 hover:opacity-80"
              style={{ color: 'var(--accent-text)' }}
            >
              Forgot password?
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={loading !== null || !email.trim() || !password}
          className="btn-primary w-full rounded-lg px-4 py-3 text-sm font-medium"
        >
          {loading === 'submit' ? submitLoadingLabel : submitLabel}
        </button>
      </form>

      <div className="flex items-center my-6">
        <div className="flex-1" style={{ borderTop: '2px solid var(--accent)' }} />
        <span
          className="px-3 text-xs uppercase tracking-wider"
          style={{ color: 'var(--text-dim)' }}
        >
          or
        </span>
        <div className="flex-1" style={{ borderTop: '2px solid var(--accent)' }} />
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading !== null}
        className="btn-secondary w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium"
      >
        <GoogleIcon />
        {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
