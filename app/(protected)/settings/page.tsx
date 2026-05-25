'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import ThemeToggle from '@/app/components/ThemeToggle';
import AuthButton from '@/app/components/AuthButton';
import { PLATFORM_DOMAINS, PLATFORM_NAMES } from '@/lib/types';
import { platformStyle } from '@/app/components/platformColors';
import { createClient } from '@/lib/supabase/client';

const ALL_PLATFORMS = Object.keys(PLATFORM_DOMAINS);
const DEFAULT_PLATFORMS = ['grailed', 'depop', 'poshmark'];

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-6 py-6"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Row within a section ───────────────────────────────────────────────────
function Row({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</div>
        {sublabel && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Delete confirmation modal ──────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      >
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Delete account</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          This permanently deletes your account and all data — watchlist, saves, and search history. This cannot be undone.
        </p>
        <p className="mt-4 text-sm font-medium" style={{ color: 'var(--text)' }}>
          Type <span style={{ color: '#E24B4A' }}>DELETE</span> to confirm
        </p>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
          className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#E24B4A'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        <div className="mt-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={typed !== 'DELETE' || loading}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#E24B4A' }}
          >
            {loading ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  );
}

type BillingStatus = {
  status: string;
  plan: 'free' | 'pro';
  used: number;
  cap: number;
  periodEnd: string | null;
};

// ── Main page ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);

  // Preferences
  const [platforms, setPlatforms] = useState<string[]>(DEFAULT_PLATFORMS);
  const [prefLoading, setPrefLoading] = useState(true);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  // Billing
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      toast.success("You're on Crawli Pro!", {
        description: 'Your subscription is active. Enjoy 100 searches per month.',
        duration: 6000,
      });
      // Clean up the param without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('billing');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? null);
      const saved = user.user_metadata?.default_platforms;
      if (Array.isArray(saved) && saved.length > 0) {
        setPlatforms(saved);
      }
      setPrefLoading(false);
    });

    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setBilling(d);
        setBillingLoading(false);
      })
      .catch(() => setBillingLoading(false));
  }, []);

  async function handleOpenPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error ?? 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  function togglePlatform(key: string) {
    setPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
    setPrefSaved(false);
  }

  async function handleSavePreferences() {
    setPrefSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_platforms: platforms }),
      });
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2500);
    } finally {
      setPrefSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/settings/delete-account', { method: 'DELETE' });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? 'Failed to delete account.');
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleteLoading}
        />
      )}

      <nav
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          borderBottom: '1px solid rgba(226, 75, 74, 0.22)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center">
            <span
              style={{
                fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.2,
              }}
            >
              Crawli
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            Settings
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Manage your preferences and account.
          </p>
        </div>

        {/* ── Account ── */}
        <Section title="Account">
          <Row label="Email" sublabel="Your sign-in address">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {email ?? '—'}
            </span>
          </Row>
          <Row label="Sign out" sublabel="Sign out of this device">
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-active)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            >
              Sign out
            </button>
          </Row>
          <Row label="Delete account" sublabel="Permanently delete your account and all data">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity"
              style={{ background: '#E24B4A' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Delete account
            </button>
          </Row>
        </Section>

        {/* ── Billing ── */}
        <Section title="Billing" description="Manage your plan and search quota.">
          {billingLoading || !billing ? (
            <div className="pt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading…
            </div>
          ) : (
            <>
              <Row
                label="Plan"
                sublabel={
                  billing.plan === 'pro'
                    ? billing.status === 'past_due'
                      ? 'Payment failed — update your card to keep your subscription active'
                      : 'Crawli Pro'
                    : 'Crawli Free'
                }
              >
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background:
                      billing.status === 'past_due'
                        ? '#d97706'
                        : billing.plan === 'pro'
                        ? 'var(--accent)'
                        : 'var(--surface-hover)',
                    color: billing.plan === 'pro' || billing.status === 'past_due' ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {billing.plan === 'pro' ? 'Pro' : 'Free'}
                </span>
              </Row>
              <Row
                label="Searches used"
                sublabel={
                  billing.plan === 'pro'
                    ? 'Resets on your next billing date'
                    : 'Resets 30 days after your first search this period'
                }
              >
                <div className="flex items-center gap-3 w-48">
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--surface-hover)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((billing.used / billing.cap) * 100))}%`,
                        background:
                          billing.used / billing.cap >= 1
                            ? '#dc2626'
                            : billing.used / billing.cap >= 0.7
                            ? '#d97706'
                            : 'var(--accent)',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs tabular-nums font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {billing.used}/{billing.cap}
                  </span>
                </div>
              </Row>
              {billing.plan === 'pro' && billing.periodEnd && (
                <Row label="Next billing date" sublabel="When your next payment will be charged">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(billing.periodEnd).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </Row>
              )}
              <Row
                label={billing.plan === 'pro' ? 'Manage subscription' : 'Upgrade to Pro'}
                sublabel={
                  billing.plan === 'pro'
                    ? 'Change plan, update card, or cancel'
                    : '100 searches/mo, $10/mo or $100/yr'
                }
              >
                {billing.plan === 'pro' ? (
                  <button
                    type="button"
                    onClick={handleOpenPortal}
                    disabled={portalLoading}
                    className="rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                    style={{
                      background: 'var(--surface-hover)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {portalLoading ? 'Opening…' : 'Manage'}
                  </button>
                ) : (
                  <Link
                    href="/pricing"
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity"
                    style={{ background: 'var(--accent)' }}
                  >
                    Upgrade
                  </Link>
                )}
              </Row>
            </>
          )}
        </Section>

        {/* ── Preferences ── */}
        <Section
          title="Preferences"
          description="Default platforms pre-selected when you start a new search."
        >
          <div className="pt-3">
            {prefLoading ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-20 rounded-full"
                    style={{ background: 'var(--surface-hover)', opacity: 0.6 }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlatforms(platforms.length === ALL_PLATFORMS.length ? [] : ALL_PLATFORMS);
                    setPrefSaved(false);
                  }}
                  className="text-xs font-medium underline underline-offset-2 transition-colors"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {platforms.length === ALL_PLATFORMS.length ? 'Clear all' : 'Select all'}
                </button>
                {ALL_PLATFORMS.map((p) => {
                  const active = platforms.includes(p);
                  const ps = platformStyle(p);
                  return (
                    <label
                      key={p}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                      style={
                        active
                          ? { background: ps.background, color: ps.color, border: '1px solid transparent' }
                          : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                      }
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={active}
                        onChange={() => togglePlatform(p)}
                      />
                      {active && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                          <path
                            fillRule="evenodd"
                            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4L8.5 12l6.8-6.8a1 1 0 0 1 1.4 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {PLATFORM_NAMES[p] ?? p}
                    </label>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={prefSaving || prefLoading}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #E24B4A, #D85A30)' }}
              >
                {prefSaving ? 'Saving…' : 'Save preferences'}
              </button>
              {prefSaved && (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Saved</span>
              )}
            </div>
          </div>
        </Section>

        {/* ── Legal ── */}
        <Section title="Legal">
          <Row label="Privacy Policy" sublabel="How we collect and use your data">
            <Link
              href="/privacy"
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              View
            </Link>
          </Row>
          <Row label="Terms of Service" sublabel="Rules for using Crawli">
            <Link
              href="/terms"
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              View
            </Link>
          </Row>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <div
            className="flex items-center justify-between gap-4 py-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  Price drop alerts
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--surface-hover)', color: 'var(--text-dim)' }}
                >
                  Coming soon
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                Get emailed when a watchlist item drops in price
              </div>
            </div>
            <div
              className="h-5 w-9 rounded-full opacity-30 cursor-not-allowed"
              style={{ background: 'var(--border)' }}
              aria-disabled
            />
          </div>
        </Section>
      </div>
    </main>
  );
}
