'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useSearchHistory } from '@/app/components/SearchHistoryProvider';
import { platformColor } from '@/app/components/platformColors';
import { PLATFORM_NAMES, type SearchHistoryItem } from '@/lib/types';
import AuthButton from '@/app/components/AuthButton';
import Wordmark from '@/app/components/landing/Wordmark';

const PENDING_SEARCH_KEY = 'crawli_pending_search';

export default function SearchHistoryPage() {
  const { items, loading, deleteSearch, clearAll } = useSearchHistory();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<SearchHistoryItem | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);

  function rerun(item: SearchHistoryItem) {
    sessionStorage.setItem(PENDING_SEARCH_KEY, JSON.stringify(item));
    router.push('/search');
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <nav
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          borderBottom: '1px solid rgba(226, 75, 74, 0.22)',
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/search" className="flex items-center">
            <Wordmark size={30} />
          </Link>
          <div className="flex items-center gap-3">
            <AuthButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Search history
            </h1>
            <p className="text-sm" style={{ color: 'var(--text)', opacity: 0.65 }}>
              {items.length} {items.length === 1 ? 'search' : 'searches'}
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearAll(true)}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: '#E24B4A' }}
            >
              Clear all
            </button>
          )}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text)', opacity: 0.6 }}>
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: 'var(--text)', opacity: 0.6 }}>
            No searches yet. Your searches will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl p-4 transition-colors"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold" style={{ color: 'var(--text)' }}>
                      {item.query}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.platforms.map((p) => (
                        <span
                          key={p}
                          className="rounded px-2 py-0.5 text-xs font-medium"
                          style={{ background: platformColor(p), color: '#FFFFFF' }}
                        >
                          {PLATFORM_NAMES[p] ?? p}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs" style={{ color: 'var(--text)', opacity: 0.5 }}>
                      {format(new Date(item.searched_at), 'MMM d, yyyy · h:mm a')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => rerun(item)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(to right, #E24B4A, #D85A30)' }}
                    >
                      Search again
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      aria-label="Delete"
                      className="rounded-lg p-2 hover:opacity-70"
                      style={{ color: 'var(--text)', opacity: 0.6 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deleteTarget && (
        <SearchDeleteModal
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteSearch(deleteTarget.id);
            toast('Removed from Search History', {
              style: { color: '#E24B4A', borderColor: '#E24B4A' },
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ),
            });
            setDeleteTarget(null);
          }}
        />
      )}

      {showClearAll && (
        <ClearAllModal
          onClose={() => setShowClearAll(false)}
          onConfirm={() => {
            clearAll();
            setShowClearAll(false);
          }}
        />
      )}
    </main>
  );
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      >
        {children}
      </div>
    </div>
  );
}

function SearchDeleteModal({
  item, onClose, onConfirm,
}: {
  item: SearchHistoryItem;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          Delete &quot;{item.query}&quot;?
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-lg leading-none"
          style={{ color: 'var(--text-dim)' }}
        >
          ×
        </button>
      </div>

      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        This search will be removed from your history.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: '#E24B4A', color: '#fff' }}
        >
          {submitting ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </ModalShell>
  );
}

function ClearAllModal({
  onClose, onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          Clear all history?
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-lg leading-none"
          style={{ color: 'var(--text-dim)' }}
        >
          ×
        </button>
      </div>

      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        All search history will be permanently deleted.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: '#E24B4A', color: '#fff' }}
        >
          {submitting ? 'Clearing…' : 'Clear all'}
        </button>
      </div>
    </ModalShell>
  );
}
