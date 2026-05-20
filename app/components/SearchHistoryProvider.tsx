'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import type { SearchHistoryItem } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

type FiltersInput = SearchHistoryItem['filters'];

interface SearchHistoryContextValue {
  items: SearchHistoryItem[];
  loading: boolean;
  addSearch: (query: string, platforms: string[], filters: FiltersInput) => Promise<void>;
  deleteSearch: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SearchHistoryContext = createContext<SearchHistoryContextValue | null>(null);

export function SearchHistoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(!!user);
      if (!user) setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const isIn = !!session?.user;
      setSignedIn(isIn);
      if (!isIn) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await fetch('/api/search-history?limit=50');
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    if (signedIn) {
      setLoading(true);
      refresh();
    }
  }, [signedIn, refresh]);

  const addSearch = useCallback(
    async (query: string, platforms: string[], filters: FiltersInput) => {
      if (!signedIn) return;
      const sortedPlatforms = [...platforms].sort();
      const optimistic: SearchHistoryItem = {
        id: `optimistic-${Date.now()}`,
        query,
        platforms: sortedPlatforms,
        filters,
        searched_at: new Date().toISOString(),
      };

      // Optimistic: remove any existing exact-dup, then prepend.
      const dedupeKey = (i: SearchHistoryItem) =>
        `${i.query}|${i.platforms.join(',')}|${JSON.stringify(i.filters)}`;
      const newKey = dedupeKey(optimistic);
      setItems((prev) => [optimistic, ...prev.filter((i) => dedupeKey(i) !== newKey)]);

      try {
        const res = await fetch('/api/search-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, platforms: sortedPlatforms, filters }),
        });
        if (!res.ok) throw new Error('post failed');
        const data = await res.json();
        setItems((prev) =>
          prev.map((i) =>
            i.id === optimistic.id ? { ...i, id: data.id, searched_at: data.searched_at } : i
          )
        );
      } catch {
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id));
      }
    },
    [signedIn]
  );

  const deleteSearch = useCallback(
    async (id: string) => {
      const before = items;
      setItems((prev) => prev.filter((i) => i.id !== id));
      try {
        const res = await fetch(`/api/search-history?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('delete failed');
      } catch {
        setItems(before);
        toast.error('Could not delete. Try again.');
      }
    },
    [items]
  );

  const clearAll = useCallback(async () => {
    const before = items;
    setItems([]);
    try {
      const res = await fetch('/api/search-history', { method: 'DELETE' });
      if (!res.ok) throw new Error('clear failed');
    } catch {
      setItems(before);
      toast.error('Could not clear history. Try again.');
    }
  }, [items]);

  const value = useMemo<SearchHistoryContextValue>(
    () => ({ items, loading, addSearch, deleteSearch, clearAll, refresh }),
    [items, loading, addSearch, deleteSearch, clearAll, refresh]
  );

  return (
    <SearchHistoryContext.Provider value={value}>{children}</SearchHistoryContext.Provider>
  );
}

export function useSearchHistory(): SearchHistoryContextValue {
  const ctx = useContext(SearchHistoryContext);
  if (!ctx) {
    return {
      items: [],
      loading: false,
      addSearch: async () => {},
      deleteSearch: async () => {},
      clearAll: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
