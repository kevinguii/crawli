'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ThemeSelector } from '@/app/components/ThemeToggle';
import { markIntentionalSignOut } from '@/app/components/shell/nav-hooks';
import { PLATFORM_DOMAINS, PLATFORM_NAMES } from '@/lib/types';
import { platformStyle } from '@/app/components/platformColors';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_PLATFORMS = ['grailed', 'mercari', 'depop'];
const ALL_PLATFORMS = Object.keys(PLATFORM_DOMAINS).sort((a, b) => {
  const aIdx = DEFAULT_PLATFORMS.indexOf(a);
  const bIdx = DEFAULT_PLATFORMS.indexOf(b);
  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
  if (aIdx !== -1) return -1;
  if (bIdx !== -1) return 1;
  return a.localeCompare(b);
});

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
      className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</div>
        {sublabel && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</div>}
      </div>
      <div className="min-w-0 sm:text-right">{children}</div>
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
          This permanently deletes your account and all data: tracked listings, saves, and search history. This cannot be undone.
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

type Tier = 'free' | 'pro' | 'max';

type BillingStatus = {
  status: string;
  tier: Tier;
  plan: Tier; // legacy alias from API
  caps: {
    searches: number;
    alerts: number;
    tracked: number;
    nativeResults: number;
  };
  usage: {
    searches: number;
    alerts: number;
    tracked: number;
  };
  // Prepaid overage credits, drawn down after the included cap is spent.
  credits: number;
  // Legacy flat fields, kept for backward compat:
  used: number;
  cap: number;
  periodEnd: string | null;
  searchResetDate: string | null;
};

const TIER_LABEL: Record<Tier, string> = { free: 'Free', pro: 'Pro', max: 'Max' };

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
  const [alertsUsed, setAlertsUsed] = useState<number | null>(null);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      toast.success("Subscription active!", {
        description: 'Your new plan is live. Refresh in a moment if details look stale.',
        duration: 6000,
      });
      // Clean up the param without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('billing');
      window.history.replaceState({}, '', url.toString());
    }
    if (searchParams.get('credits') === 'success') {
      toast.success('Credits added!', {
        description: 'Your extra searches are ready. Refresh in a moment if the balance looks stale.',
        duration: 6000,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('credits');
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

    fetch('/api/saved-searches')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: { paused?: boolean }[]) => {
        // Paused alerts don't count toward the cap.
        setAlertsUsed(d.filter((a) => !a.paused).length);
      })
      .catch(() => {});
  }, []);

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
    markIntentionalSignOut();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
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
      markIntentionalSignOut();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <>
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleteLoading}
        />
      )}

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
            <span className="text-sm break-all" style={{ color: 'var(--text-muted)' }}>
              {email ?? '-'}
            </span>
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
              {(() => {
                const tier: Tier = billing.tier ?? billing.plan ?? 'free';
                const isPaid = tier !== 'free';
                const tierLabel = TIER_LABEL[tier];
                const searchCap = billing.caps?.searches ?? billing.cap;
                const alertCap = billing.caps?.alerts ?? (isPaid ? 3 : 1);
                const searchesUsed = billing.usage?.searches ?? billing.used;
                const alertsUsedNow = alertsUsed ?? billing.usage?.alerts ?? null;
                return (
                  <>
                    <Row
                      label="Plan"
                      sublabel={
                        billing.status === 'past_due'
                          ? 'Payment failed: update your card to keep your subscription active'
                          : `Crawli ${tierLabel}`
                      }
                    >
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          background:
                            billing.status === 'past_due'
                              ? '#d97706'
                              : isPaid
                              ? 'var(--accent)'
                              : 'var(--surface-hover)',
                          color: isPaid || billing.status === 'past_due' ? '#ffffff' : 'var(--text-muted)',
                        }}
                      >
                        {tierLabel}
                      </span>
                    </Row>
                    <Row
                      label="Searches remaining"
                      sublabel={
                        billing.searchResetDate
                          ? `Resets ${new Date(billing.searchResetDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                          : 'Resets weekly'
                      }
                    >
                      {(() => {
                        const remaining = Math.max(0, searchCap - searchesUsed);
                        const remainingPct = searchCap > 0 ? remaining / searchCap : 0;
                        const barColor =
                          remainingPct <= 0.1
                            ? '#dc2626'
                            : remainingPct <= 0.4
                            ? '#f59e0b'
                            : '#22c55e';
                        return (
                          <div className="flex items-center gap-3 w-48">
                            <div
                              className="flex-1 h-2 rounded-full overflow-hidden"
                              style={{ background: 'var(--surface-hover)' }}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.round(remainingPct * 100)}%`, background: barColor }}
                              />
                            </div>
                            <span
                              className="text-xs tabular-nums font-medium"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {remaining}/{searchCap}
                            </span>
                          </div>
                        );
                      })()}
                    </Row>
                    <Row
                      label="Search alerts remaining"
                      sublabel={`Up to ${alertCap} alert${alertCap === 1 ? '' : 's'}, checks daily or weekly`}
                    >
                      {(() => {
                        const alertRemaining = alertsUsedNow === null ? alertCap : Math.max(0, alertCap - alertsUsedNow);
                        const alertPct = alertCap > 0 ? alertRemaining / alertCap : 0;
                        const alertColor = alertPct <= 0.1 ? '#dc2626' : alertPct <= 0.4 ? '#f59e0b' : '#22c55e';
                        return (
                          <div className="flex items-center gap-3 w-48">
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.round(alertPct * 100)}%`, background: alertColor }}
                              />
                            </div>
                            <span className="text-xs tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
                              {alertsUsedNow === null ? alertCap : alertRemaining}/{alertCap}
                            </span>
                          </div>
                        );
                      })()}
                    </Row>
                    <Row
                      label="Overage credits"
                      sublabel="Extra searches used after your weekly quota runs out"
                    >
                      <span className="text-xs tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
                        {billing.credits ?? 0}
                      </span>
                    </Row>

                    {isPaid && billing.periodEnd && (
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
                      label={isPaid ? 'Manage subscription' : 'Upgrade'}
                      sublabel={
                        isPaid
                          ? 'Upgrade, switch plan, or cancel'
                          : 'Unlock more searches, alerts, and tracked listings'
                      }
                    >
                      <Link
                        href="/pricing?from=/settings"
                        className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                          background: isPaid ? 'var(--surface-hover)' : 'var(--accent)',
                          color: isPaid ? 'var(--text)' : '#fff',
                          border: isPaid ? '1px solid var(--border)' : 'none',
                          fontWeight: isPaid ? 500 : 600,
                        }}
                      >
                        {isPaid ? 'Manage' : 'Upgrade'}
                      </Link>
                    </Row>
                    <Row
                      label="Buy more credits"
                      sublabel="One-time credit packs, no subscription"
                    >
                      <Link
                        href="/pricing?from=/settings#credits"
                        className="text-sm font-medium underline underline-offset-2 transition-colors"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        View packs →
                      </Link>
                    </Row>
                  </>
                );
              })()}
            </>
          )}
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance" description="Choose how Crawli looks on this device.">
          <Row label="Theme" sublabel="Light, dark, or match your system setting">
            <ThemeSelector />
          </Row>
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

        {/* ── Support ── */}
        <Section title="Support" description="Questions, feedback, or bugs? We'd love to hear from you.">
          <Row label="Contact us" sublabel="Send feedback or get help">
            <Link
              href="/contact"
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              Get in touch
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

        {/* ── Sign out / Delete ── */}
        <Section title="Session & account">
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
      </div>
    </>
  );
}
