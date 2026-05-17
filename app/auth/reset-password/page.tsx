'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AuthCard, { EyeIcon, EyeOffIcon } from '@/app/components/AuthCard';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.replace('/login?error=reset_expired');
        return;
      }
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (checking) {
    return (
      <AuthCard>
        <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Verifying your reset link…
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold text-center mb-1" style={{ color: 'var(--text)' }}>
        Set new password
      </h1>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
        Choose a new password for your account.
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
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            placeholder="New password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
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
        <input
          type={showPassword ? 'text' : 'password'}
          required
          minLength={6}
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={loading}
          className="input-base w-full rounded-lg px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="btn-primary w-full rounded-lg px-4 py-3 text-sm font-medium"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthCard>
  );
}
