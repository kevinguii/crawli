'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CollectionFolder } from '@/lib/types';

export interface MoveModalRequest {
  saveId: string;
  currentFolderId: string | null;
  onMoved?: (folderId: string, folderName: string) => void;
}

export default function MoveToFolderModal({
  request,
  onClose,
}: {
  request: MoveModalRequest | null;
  onClose: () => void;
}) {
  const [folders, setFolders] = useState<CollectionFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/collection-folders');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!cancelled) setFolders(data.folders ?? []);
      } catch {
        if (!cancelled) toast.error('Could not load folders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [request, onClose]);

  if (!request) return null;

  const handleMove = async (folder: CollectionFolder) => {
    if (folder.id === request.currentFolderId) {
      onClose();
      return;
    }
    setMoving(true);
    try {
      const res = await fetch(`/api/saves/${request.saveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folder.id }),
      });
      if (!res.ok) throw new Error('move failed');
      toast.success(`Moved to ${folder.name}`);
      request.onMoved?.(folder.id, folder.name);
      onClose();
    } catch {
      toast.error("Couldn't move item");
    } finally {
      setMoving(false);
    }
  };

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Move to folder
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

        {loading ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
            Loading folders…
          </div>
        ) : (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {folders.map((f) => {
              const isCurrent = f.id === request.currentFolderId;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={moving || isCurrent}
                  onClick={() => handleMove(f)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50"
                  style={{
                    background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>{f.name}</span>
                  <span
                    className="text-xs"
                    style={{ color: isCurrent ? 'var(--accent-text)' : 'var(--text-dim)' }}
                  >
                    {isCurrent ? 'Already here' : f.item_count != null ? `${f.item_count} items` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
