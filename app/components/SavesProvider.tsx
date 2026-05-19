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
import MoveToFolderModal, { type MoveModalRequest } from '@/app/components/MoveToFolderModal';

interface SavesContextValue {
  savedUrls: Set<string>;
  isSaved: (url: string) => boolean;
  toggleSave: (listing: Listing) => Promise<void>;
  hydrateUrls: (urls: string[]) => void;
  refresh: () => Promise<void>;
  openMoveModal: (req: MoveModalRequest) => void;
}

const SavesContext = createContext<SavesContextValue | null>(null);

export function SavesProvider({ children }: { children: React.ReactNode }) {
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [signedIn, setSignedIn] = useState(false);
  const [moveRequest, setMoveRequest] = useState<MoveModalRequest | null>(null);
  const checkedUrls = useRef<Set<string>>(new Set());

  const openMoveModal = useCallback((req: MoveModalRequest) => {
    setMoveRequest(req);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(!!user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const isIn = !!session?.user;
      setSignedIn(isIn);
      if (!isIn) {
        setSavedUrls(new Set());
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
        const res = await fetch('/api/saves/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: fresh }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const matched: string[] = data.saved_urls ?? [];
        if (matched.length === 0) return;
        setSavedUrls((prev) => {
          const next = new Set(prev);
          matched.forEach((u) => next.add(u));
          return next;
        });
      } catch {
        // silent — heart will just show as unsaved
      }
    },
    [signedIn]
  );

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await fetch('/api/saves');
      if (!res.ok) return;
      const data = await res.json();
      const urls: string[] = (data.saves ?? []).map((s: { listing_url: string }) => s.listing_url);
      checkedUrls.current = new Set(urls);
      setSavedUrls(new Set(urls));
    } catch {
      // silent
    }
  }, [signedIn]);

  const toggleSave = useCallback(
    async (listing: Listing) => {
      if (!signedIn) {
        toast.error('Sign in to save listings');
        return;
      }

      const url = listing.url;
      const wasSaved = savedUrls.has(url);

      // Optimistic update
      setSavedUrls((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(url);
        else next.add(url);
        return next;
      });

      try {
        if (wasSaved) {
          const res = await fetch(`/api/saves?url=${encodeURIComponent(url)}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('delete failed');
          toast('Removed from My Collection', {
            style: { color: '#E24B4A', borderColor: '#E24B4A' },
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ),
          });
        } else {
          const res = await fetch('/api/saves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              listing_url: url,
              platform: listing.platform,
              title: listing.title,
              price: listing.price,
              currency: listing.currency,
              condition: listing.condition,
              image_url: listing.image,
              seller: listing.seller,
            }),
          });
          if (!res.ok) throw new Error('save failed');
          const data = await res.json().catch(() => ({}));
          const saveId: string | undefined = data?.save_id;
          const currentFolderId: string | null = data?.folder_id ?? null;
          toast.success('Saved to My Collection', {
            action: saveId
              ? {
                  label: 'Move to folder…',
                  onClick: () => setMoveRequest({ saveId, currentFolderId }),
                }
              : undefined,
          });
        }
      } catch {
        // Roll back optimistic change.
        setSavedUrls((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(url);
          else next.delete(url);
          return next;
        });
        toast.error(wasSaved ? 'Could not remove. Try again.' : 'Could not save. Try again.');
      }
    },
    [signedIn, savedUrls]
  );

  const value = useMemo<SavesContextValue>(
    () => ({
      savedUrls,
      isSaved: (url: string) => savedUrls.has(url),
      toggleSave,
      hydrateUrls,
      refresh,
      openMoveModal,
    }),
    [savedUrls, toggleSave, hydrateUrls, refresh, openMoveModal]
  );

  return (
    <SavesContext.Provider value={value}>
      {children}
      <MoveToFolderModal request={moveRequest} onClose={() => setMoveRequest(null)} />
    </SavesContext.Provider>
  );
}

export function useSaves(): SavesContextValue {
  const ctx = useContext(SavesContext);
  if (!ctx) {
    // Render gracefully outside provider (e.g. unprotected pages) — no-op.
    return {
      savedUrls: new Set(),
      isSaved: () => false,
      toggleSave: async () => {},
      hydrateUrls: () => {},
      refresh: async () => {},
      openMoveModal: () => {},
    };
  }
  return ctx;
}
