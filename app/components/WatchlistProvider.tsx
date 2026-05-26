'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import type { Listing } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface WatchlistContextValue {
  watchedUrls: Set<string>;
  isWatched: (url: string) => boolean;
  toggleWatch: (listing: Listing) => Promise<void>;
  hydrateUrls: (urls: string[]) => void;
  refresh: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchedUrls, setWatchedUrls] = useState<Set<string>>(new Set());
  const [signedIn, setSignedIn] = useState(false);
  const checkedUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(!!user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const isIn = !!session?.user;
      setSignedIn(isIn);
      if (!isIn) {
        setWatchedUrls(new Set());
        checkedUrls.current = new Set();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const hydrateUrls = useCallback(
    async (urls: string[]) => {
      if (!signedIn || urls.length === 0) return;
      const fresh = urls.filter((u) => !checkedUrls.current.has(u));
      if (fresh.length === 0) return;
      fresh.forEach((u) => checkedUrls.current.add(u));

      try {
        const res = await fetch('/api/watchlist/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: fresh }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const matched: string[] = data.watched_urls ?? [];
        if (matched.length === 0) return;
        setWatchedUrls((prev) => {
          const next = new Set(prev);
          matched.forEach((u) => next.add(u));
          return next;
        });
      } catch {
        // silent
      }
    },
    [signedIn]
  );

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await fetch('/api/watchlist');
      if (!res.ok) return;
      const data = await res.json();
      const urls: string[] = (data.watchlist ?? []).map((w: { listing_url: string }) => w.listing_url);
      checkedUrls.current = new Set(urls);
      setWatchedUrls(new Set(urls));
    } catch {
      // silent
    }
  }, [signedIn]);

  const toggleWatch = useCallback(
    async (listing: Listing) => {
      if (!signedIn) {
        toast.error('Sign in to watch listings');
        return;
      }

      const url = listing.url;
      const wasWatched = watchedUrls.has(url);

      setWatchedUrls((prev) => {
        const next = new Set(prev);
        if (wasWatched) next.delete(url);
        else next.add(url);
        return next;
      });

      try {
        if (wasWatched) {
          const res = await fetch(`/api/watchlist?url=${encodeURIComponent(url)}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('delete failed');
          toast.success('Removed from Watchlist');
        } else {
          const res = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              listing_url: url,
              platform: listing.platform,
              title: listing.title,
              price: listing.price,
              currency: listing.currency,
              image_url: listing.image,
            }),
          });
          if (!res.ok) throw new Error('watch failed');
          toast.success('Added to Watchlist');
        }
      } catch {
        setWatchedUrls((prev) => {
          const next = new Set(prev);
          if (wasWatched) next.add(url);
          else next.delete(url);
          return next;
        });
        toast.error(wasWatched ? 'Could not remove. Try again.' : 'Could not add. Try again.');
      }
    },
    [signedIn, watchedUrls]
  );

  const value = useMemo<WatchlistContextValue>(
    () => ({
      watchedUrls,
      isWatched: (url: string) => watchedUrls.has(url),
      toggleWatch,
      hydrateUrls,
      refresh,
    }),
    [watchedUrls, toggleWatch, hydrateUrls, refresh]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    return {
      watchedUrls: new Set(),
      isWatched: () => false,
      toggleWatch: async () => {},
      hydrateUrls: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
