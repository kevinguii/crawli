'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  PlatformResults,
  SearchResponse,
  SearchStreamEvent,
  SearchHistoryItem,
} from '@/lib/types';
import FilterPanel, {
  emptyFilterState,
  filtersToQuerySuffix,
  FilterState,
} from './FilterPanel';
import { useSearchHistory } from './SearchHistoryProvider';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const PENDING_SEARCH_KEY = 'crawli_pending_search';
// Prefill only (no auto-run), used by profile dashboard recent searches
const PREFILL_SEARCH_KEY = 'crawli_prefill_search';

const DEFAULT_PLATFORMS = ['grailed', 'mercari', 'depop'];

// Downscale before upload: the model doesn't need full phone-camera
// resolution to describe a garment, and this keeps the request payload and
// image-token cost small.
async function resizeImageToBase64(file: File, maxDim = 1024, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return dataUrl.split(',')[1] ?? '';
}

interface Props {
  onResults: (data: SearchResponse, query: string, platforms: string[]) => void;
  onError: (msg: string) => void;
  onProgress: (event: SearchStreamEvent) => void;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// Read sessionStorage at init time so query/selected start with the right values
// on the first render, avoiding setState-in-effect cascades.
type SessionInit = {
  query: string;
  platforms: string[];
  filtersOverride: Partial<FilterState> | null;
  autoRun: boolean;
};

function readSessionInit(): SessionInit {
  if (typeof window === 'undefined') {
    return { query: '', platforms: DEFAULT_PLATFORMS, filtersOverride: null, autoRun: false };
  }
  const pendingRaw = sessionStorage.getItem(PENDING_SEARCH_KEY);
  if (pendingRaw) {
    sessionStorage.removeItem(PENDING_SEARCH_KEY);
    try {
      const item = JSON.parse(pendingRaw) as SearchHistoryItem;
      return { query: item.query, platforms: item.platforms, filtersOverride: item.filters ?? null, autoRun: true };
    } catch {}
  }
  const prefillRaw = sessionStorage.getItem(PREFILL_SEARCH_KEY);
  if (prefillRaw) {
    sessionStorage.removeItem(PREFILL_SEARCH_KEY);
    try {
      const item = JSON.parse(prefillRaw) as SearchHistoryItem;
      return { query: item.query, platforms: item.platforms, filtersOverride: item.filters ?? null, autoRun: false };
    } catch {}
  }
  return { query: '', platforms: DEFAULT_PLATFORMS, filtersOverride: null, autoRun: false };
}

export default function SearchForm({ onResults, onError, onProgress, filters, onFiltersChange, abortControllerRef }: Props) {
  const [{ query: initQuery, platforms: initPlatforms, filtersOverride, autoRun }] = useState(readSessionInit);
  const [query, setQuery] = useState(initQuery);
  const [selected, setSelected] = useState<string[]>(initPlatforms);
  const [isLoading, setIsLoading] = useState(false);
  const [isIdentifyingPhoto, setIsIdentifyingPhoto] = useState(false);
  const [photoCandidates, setPhotoCandidates] = useState<string[]>([]);
  const [quota, setQuota] = useState<{ tier: string; remaining: number; credits: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { addSearch } = useSearchHistory();

  // Auto-fill only, never auto-submits. A single identified item lands
  // directly in the same editable field a typed query would. Multiple items
  // (e.g. a full outfit) surface as chips instead of guessing which one the
  // user meant; picking a chip fills the field the same way.
  async function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setPhotoCandidates([]);
    setIsIdentifyingPhoto(true);
    try {
      const image = await resizeImageToBase64(file);
      const res = await fetch('/api/search/identify-photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) throw new Error('identify failed');
      const data = (await res.json()) as { items?: string[] };
      const items = data.items ?? [];
      if (items.length === 1) {
        setQuery(items[0]);
      } else if (items.length > 1) {
        setPhotoCandidates(items);
      } else {
        throw new Error('no items identified');
      }
    } catch {
      toast.error("Couldn't identify that photo, try typing your search instead.");
    } finally {
      setIsIdentifyingPhoto(false);
    }
  }

  // Last-search nudge: only meaningful on the free tier, where the cap (3)
  // is too small for a ratio-based warning to ever fire before exhaustion.
  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setQuota({ tier: d.tier ?? d.plan, remaining: Math.max(0, d.cap - d.used), credits: d.credits ?? 0 });
      })
      .catch(() => {});
  }, []);

  // Apply the initial filters override (prop callback, not setState) and
  // trigger auto-submit for searches replayed from history.
  useEffect(() => {
    if (filtersOverride) onFiltersChange({ ...emptyFilterState(), ...filtersOverride });
    if (autoRun) setTimeout(() => formRef.current?.requestSubmit(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user's saved default platforms from their account settings.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const saved = user?.user_metadata?.default_platforms;
      if (Array.isArray(saved) && saved.length > 0) {
        setSelected(saved);
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const baseQ = query.trim();
    if (isLoading) return;
    if (!baseQ) return;
    if (selected.length === 0) {
      onError('Please select at least one platform before searching.');
      return;
    }

    // Append every active filter (color, category, condition, size) as keywords
    // so each platform's own search index gets the extra signal.
    const suffix = filtersToQuerySuffix(filters);
    const q = suffix ? `${baseQ} ${suffix}` : baseQ;

    setIsLoading(true);
    // Optimistically decrement the nav counter immediately so quota feels instant
    window.dispatchEvent(new CustomEvent('crawli:search-started'));
    setQuota((prev) => {
      if (!prev) return prev;
      // Spend an included search first; once those are gone, draw down a credit.
      return prev.remaining > 0
        ? { ...prev, remaining: prev.remaining - 1 }
        : { ...prev, credits: Math.max(0, prev.credits - 1) };
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const platformsForRun = [...selected];
    const results: Record<string, PlatformResults> = {};

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, platforms: platformsForRun, filters }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = 'Search failed. Please try again.';
        let errorCode: string | undefined;
        let quotaMessage: string | undefined;
        let quotaPlan: string | undefined;
        try {
          const data = await res.json();
          errorCode = data?.error;
          quotaMessage = data?.message;
          quotaPlan = data?.plan;
          msg = quotaMessage ?? data?.error ?? msg;
        } catch {}

        // 402 quota_exceeded: show a richer toast with an Upgrade CTA
        // instead of routing through the generic onError red banner.
        if (res.status === 402 && errorCode === 'quota_exceeded') {
          // Paid tiers are sold as "Unlimited searches": the cap they just hit is
          // an anti-abuse backstop, so do NOT offer them credits or an upgrade
          // (Pro is the top plan). Send them to support instead. Free users get
          // the original buy-credits path.
          const isPaid = quotaPlan != null && quotaPlan !== 'free';
          toast.error(quotaMessage ?? 'Search limit reached.', {
            action: isPaid
              ? {
                  label: 'Contact us',
                  onClick: () => { window.location.href = '/settings?from=/search'; },
                }
              : {
                  label: 'Buy credits',
                  onClick: () => { window.location.href = '/settings?from=/search#credits'; },
                },
            duration: 8000,
          });
          return;
        }

        onError(msg);
        return;
      }

      if (!res.body) {
        onError('No response stream from server.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let priceRange: SearchResponse['priceRange'] = null;
      let averagePrice: SearchResponse['averagePrice'] = null;
      let sawFinal = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: SearchStreamEvent;
          try {
            event = JSON.parse(trimmed) as SearchStreamEvent;
          } catch (err) {
            console.error('[search] failed to parse stream line:', trimmed, err);
            continue;
          }
          onProgress(event);
          if (event.type === 'platform_done') {
            results[event.platform] = {
              listings: event.listings,
              count: event.count,
            };
          } else if (event.type === 'final') {
            priceRange = event.priceRange;
            averagePrice = event.averagePrice;
            sawFinal = true;
          }
        }
      }

      if (!sawFinal) {
        onError('Search ended unexpectedly before completing.');
        return;
      }

      // Add to history only on successful search completion.
      void addSearch(baseQ, [...selected].sort(), filters);

      // Ensure every requested platform has an entry, even if no event arrived.
      for (const p of platformsForRun) {
        if (!results[p]) results[p] = { listings: [], count: 0 };
      }

      onResults({
        success: true,
        query: q,
        results,
        priceRange,
        averagePrice,
      }, baseQ, platformsForRun);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        onError('Search cancelled.');
      } else {
        onError('Network error. Please check your connection.');
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }

  // Free tier with no included searches left can still search if they hold
  // prepaid overage credits, only hard-block when both are zero.
  const isExhausted = quota?.tier === 'free' && quota.remaining === 0 && quota.credits === 0;
  const onCredits = quota?.tier === 'free' && quota.remaining === 0 && quota.credits > 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a product (e.g. Nike Air Jordan 1 Chicago)"
          disabled={isExhausted}
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(226, 75, 74, 0.18)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelected}
          className="hidden"
        />
        {/* Photo button + Search share a row on mobile (sm:contents dissolves this
            wrapper into the parent flex row at the sm breakpoint, restoring the
            original single-row desktop layout with no extra markup). */}
        <div className="flex gap-3 sm:contents">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={isExhausted || isIdentifyingPhoto}
            title="Search from a photo"
            aria-label="Search from a photo"
            className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={
              isIdentifyingPhoto
                ? { background: 'rgba(226, 75, 74, 0.08)', border: '1px solid rgba(226, 75, 74, 0.25)', color: 'var(--text)' }
                : { background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)' }
            }
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled || isIdentifyingPhoto) return;
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              if (isIdentifyingPhoto) return;
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {isIdentifyingPhoto ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>Identifying…</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-80">
                  <path d="M4 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.17l-.83-1.5A1 1 0 0 0 13.13 3H6.87a1 1 0 0 0-.87.5L5.17 5H4Zm6 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
                </svg>
                <span className="hidden sm:inline">Photo search</span>
                <span className="sm:hidden">Photo</span>
              </>
            )}
          </button>
          <button
            type="submit"
            disabled={isLoading || !query.trim() || isExhausted}
            className="flex-1 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
            style={{ background: 'linear-gradient(to right, #E24B4A, #D85A30)' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.background = 'linear-gradient(to right, #D85A30, #E84D1D)';
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(to right, #E24B4A, #D85A30)')}
          >
            {isLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {photoCandidates.length > 0 && (
        <div className="rounded-xl px-3.5 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text)', opacity: 0.4 }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-70">
              <path d="M4 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.17l-.83-1.5A1 1 0 0 0 13.13 3H6.87a1 1 0 0 0-.87.5L5.17 5H4Zm6 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
            </svg>
            <span>Found in your photo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {photoCandidates.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setQuery(item);
                  setPhotoCandidates([]);
                }}
                className="inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-xs font-medium transition-colors"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', color: 'var(--text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {quota?.tier === 'free' && quota.remaining === 1 && (
        <p className="text-xs" style={{ color: '#d97706' }}>
          You have one search remaining this week.{' '}
          <Link href="/pricing?from=/search" className="font-semibold underline">
            Upgrade
          </Link>{' '}
          for more.
        </p>
      )}

      {onCredits && (
        <p className="text-xs" style={{ color: '#d97706' }}>
          Weekly searches used. Now using overage credits: {quota?.credits} left.{' '}
          <Link href="/settings#credits" className="font-semibold underline">
            Buy more
          </Link>{' '}
          or{' '}
          <Link href="/pricing?from=/search" className="font-semibold underline">
            upgrade
          </Link>.
        </p>
      )}

      {isExhausted && (
        <p className="text-xs" style={{ color: '#dc2626' }}>
          You have no searches remaining this week.{' '}
          <Link href="/settings#credits" className="font-semibold underline">
            Buy credits
          </Link>{' '}
          or{' '}
          <Link href="/pricing?from=/search" className="font-semibold underline">
            upgrade
          </Link>.
        </p>
      )}

      <FilterPanel
        platforms={selected}
        onPlatformsChange={setSelected}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    </form>
  );
}
