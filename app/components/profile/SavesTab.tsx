'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { Save, CollectionFolder } from '@/lib/types';
import { PLATFORM_NAMES } from '@/lib/types';
import PlatformBadge from '@/app/components/PlatformBadge';
import { useSaves } from '@/app/components/SavesProvider';
import { useWatchlist } from '@/app/components/WatchlistProvider';

type ViewMode = 'pills' | 'cards';
const VIEW_MODE_KEY = 'collectionViewMode';

// External store for the view-mode preference. useSyncExternalStore is the React 19
// idiomatic way to bind a component to a non-React data source (here, localStorage)
// without tripping `react-hooks/set-state-in-effect`.
const viewModeSubscribers = new Set<() => void>();
function viewModeSubscribe(cb: () => void) {
  viewModeSubscribers.add(cb);
  return () => { viewModeSubscribers.delete(cb); };
}
function viewModeGetSnapshot(): ViewMode {
  const stored = window.localStorage.getItem(VIEW_MODE_KEY);
  return stored === 'cards' || stored === 'pills' ? stored : 'pills';
}
function viewModeGetServerSnapshot(): ViewMode {
  return 'pills';
}
function setViewModeStored(v: ViewMode) {
  try { window.localStorage.setItem(VIEW_MODE_KEY, v); } catch {}
  viewModeSubscribers.forEach((cb) => cb());
}

type FolderEditMode =
  | { kind: 'create' }
  | { kind: 'edit'; folder: CollectionFolder };

export default function SavesTab() {
  const [folders, setFolders] = useState<CollectionFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [saves, setSaves] = useState<Save[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const viewMode = useSyncExternalStore(
    viewModeSubscribe,
    viewModeGetSnapshot,
    viewModeGetServerSnapshot,
  );
  const [editMode, setEditMode] = useState<FolderEditMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionFolder | null>(null);
  const [deleteSaveTarget, setDeleteSaveTarget] = useState<Save | null>(null);
  const [cardViewFolderId, setCardViewFolderId] = useState<string | null>(null);
  const { hydrateUrls, openMoveModal } = useSaves();

  const toggleViewMode = () => {
    setViewModeStored(viewMode === 'pills' ? 'cards' : 'pills');
  };

  const reloadFolders = useCallback(async (selectDefaultIfNone = false) => {
    try {
      const res = await fetch('/api/collection-folders');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      const next: CollectionFolder[] = data.folders ?? [];
      setFolders(next);
      if (selectDefaultIfNone) {
        setActiveFolderId((curr) => {
          if (curr && next.some((f) => f.id === curr)) return curr;
          return next.find((f) => f.is_default)?.id ?? next[0]?.id ?? null;
        });
      }
      return next;
    } catch {
      toast.error('Could not load folders');
      return [];
    }
  }, []);

  // reloadFolders is a useCallback that fetches over the network and only calls
  // setState after `await`, so the setState is not synchronous in the effect body.
  // The lint rule can't see through the useCallback indirection.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reloadFolders(true); }, [reloadFolders]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (activeFolderId) params.set('folder_id', activeFolderId);
        const res = await fetch(`/api/saves${params.toString() ? `?${params}` : ''}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (cancelled) return;
        const next: Save[] = data.saves ?? [];
        setSaves(next);
        hydrateUrls(next.map((s) => s.listing_url));
      } catch {
        if (!cancelled) toast.error('Could not load saves');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [debouncedSearch, activeFolderId, hydrateUrls]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId) ?? null,
    [folders, activeFolderId]
  );
  const isDefaultActive = activeFolder?.is_default ?? false;
  const totalItems = useMemo(
    () => folders.find((f) => f.is_default)?.item_count ?? 0,
    [folders]
  );

  const submitRemoveSave = async (save: Save) => {
    const prev = saves;
    setSaves((s) => s.filter((x) => x.id !== save.id));
    try {
      const res = await fetch(`/api/saves/${save.id}`, { method: 'DELETE' });
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
      reloadFolders();
    } catch {
      setSaves(prev);
      toast.error('Could not remove. Try again.');
    }
  };

  const handleMove = (save: Save) => {
    openMoveModal({
      saveId: save.id,
      currentFolderId: save.folder_id,
      onMoved: (folderId) => {
        if (activeFolder && !activeFolder.is_default && folderId !== activeFolderId) {
          // In a custom folder view, moving out should hide it from the current list.
          setSaves((s) => s.filter((x) => x.id !== save.id));
        } else {
          // In My Collection (or moving within the active folder), keep the item visible
          // but reflect its new folder_id so subsequent moves know the current folder.
          setSaves((s) => s.map((x) => x.id === save.id ? { ...x, folder_id: folderId } : x));
        }
        reloadFolders();
      },
    });
  };

  const submitFolder = async (mode: FolderEditMode, payload: { name: string; description: string }) => {
    const body: { name?: string; description: string } = { description: payload.description };
    if (mode.kind === 'create') {
      try {
        const res = await fetch('/api/collection-folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payload.name, description: payload.description }),
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        toast.success(`Created "${data.folder.name}"`);
        const next = await reloadFolders();
        const created = next.find((f) => f.id === data.folder.id);
        if (created) setActiveFolderId(created.id);
      } catch {
        toast.error('Could not create folder');
      }
    } else {
      try {
        if (!mode.folder.is_default) body.name = payload.name;
        const res = await fetch(`/api/collection-folders/${mode.folder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('failed');
        toast.success('Folder updated');
        reloadFolders();
      } catch {
        toast.error("Couldn't update folder");
      }
    }
  };

  const submitDelete = async (folder: CollectionFolder, cascade: boolean) => {
    try {
      const url = `/api/collection-folders/${folder.id}${cascade ? '?cascade=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      toast(cascade ? `Deleted "${folder.name}" and its items` : `Deleted "${folder.name}"`, {
        style: { color: '#22c55e', borderColor: '#22c55e' },
      });
      const next = await reloadFolders();
      if (activeFolderId === folder.id) {
        setActiveFolderId(next.find((f) => f.is_default)?.id ?? null);
      }
    } catch {
      toast.error('Could not delete folder');
    }
  };

  const empty = !loading && saves.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved listings..."
          className="input-base flex-1 rounded-lg px-4 py-2.5 text-sm"
        />
        <ViewModeToggle viewMode={viewMode} onToggle={toggleViewMode} />
      </div>

      <button
        type="button"
        onClick={() => setEditMode({ kind: 'create' })}
        className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors w-fit"
        style={{
          background: 'var(--accent)',
          color: '#ffffff',
        }}
        aria-label="Create new collection"
      >
        + New collection
      </button>

      {viewMode === 'pills' ? (
        <>
          <FolderPillRow
            folders={folders}
            activeId={activeFolderId}
            onSelect={setActiveFolderId}
            onEdit={(f) => setEditMode({ kind: 'edit', folder: f })}
            onDelete={(f) => setDeleteTarget(f)}
          />

          {activeFolder && (
            <FolderDescription folder={activeFolder} onEdit={() => setEditMode({ kind: 'edit', folder: activeFolder })} />
          )}

          {loading && saves.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
              Loading collection…
            </div>
          ) : empty ? (
            <EmptyState
              search={debouncedSearch}
              isDefaultActive={isDefaultActive}
              activeFolderName={activeFolder?.name ?? null}
              totalItems={totalItems}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {saves.map((s) => (
                <SaveCard
                  key={s.id}
                  save={s}
                  onRemove={() => setDeleteSaveTarget(s)}
                  onMove={() => handleMove(s)}
                />
              ))}
            </div>
          )}
        </>
      ) : cardViewFolderId ? (
        <>
          <button
            type="button"
            onClick={() => setCardViewFolderId(null)}
            className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {activeFolder && (
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                {activeFolder.name}
              </h2>
              {activeFolder.description && (
                <p
                  className="mb-4 text-sm leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {activeFolder.description}
                </p>
              )}
            </div>
          )}

          {loading && saves.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
              Loading collection…
            </div>
          ) : empty ? (
            <EmptyState
              search={debouncedSearch}
              isDefaultActive={isDefaultActive}
              activeFolderName={activeFolder?.name ?? null}
              totalItems={totalItems}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {saves.map((s) => (
                <SaveCard
                  key={s.id}
                  save={s}
                  onRemove={() => setDeleteSaveTarget(s)}
                  onMove={() => handleMove(s)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <FolderCardGrid
          folders={folders}
          onSelect={(folderId) => {
            setCardViewFolderId(folderId);
            setActiveFolderId(folderId);
          }}
          onEdit={(f) => setEditMode({ kind: 'edit', folder: f })}
          onDelete={(f) => setDeleteTarget(f)}
        />
      )}

      {editMode && (
        <FolderEditModal
          mode={editMode}
          folders={folders}
          onClose={() => setEditMode(null)}
          onSubmit={(payload) => submitFolder(editMode, payload).then(() => setEditMode(null))}
        />
      )}

      {deleteTarget && (
        <FolderDeleteModal
          folder={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={(cascade) => submitDelete(deleteTarget, cascade).then(() => setDeleteTarget(null))}
        />
      )}

      {deleteSaveTarget && (
        <SaveDeleteModal
          save={deleteSaveTarget}
          onClose={() => setDeleteSaveTarget(null)}
          onConfirm={() => submitRemoveSave(deleteSaveTarget).then(() => setDeleteSaveTarget(null))}
        />
      )}
    </div>
  );
}

function ViewModeToggle({ viewMode, onToggle }: { viewMode: ViewMode; onToggle: () => void }) {
  return (
    <div
      className="inline-flex items-center gap-0 rounded-lg p-1"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <button
        type="button"
        onClick={viewMode === 'pills' ? undefined : onToggle}
        disabled={viewMode === 'pills'}
        className="flex h-8 w-8 items-center justify-center rounded transition-colors disabled:cursor-default"
        style={{
          background: viewMode === 'pills' ? 'var(--accent)' : 'transparent',
          color: viewMode === 'pills' ? '#ffffff' : 'var(--text-muted)',
        }}
        aria-label="Pills view"
        title="Folder list view"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={viewMode === 'cards' ? undefined : onToggle}
        disabled={viewMode === 'cards'}
        className="flex h-8 w-8 items-center justify-center rounded transition-colors disabled:cursor-default"
        style={{
          background: viewMode === 'cards' ? 'var(--accent)' : 'transparent',
          color: viewMode === 'cards' ? '#ffffff' : 'var(--text-muted)',
        }}
        aria-label="Cards view"
        title="Grid card view"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      </button>
    </div>
  );
}

function FolderPillRow({
  folders, activeId, onSelect, onEdit, onDelete,
}: {
  folders: CollectionFolder[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onEdit: (f: CollectionFolder) => void;
  onDelete: (f: CollectionFolder) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {folders.map((f) => (
        <FolderPill
          key={f.id}
          folder={f}
          active={f.id === activeId}
          onSelect={() => onSelect(f.id)}
          onEdit={() => onEdit(f)}
          onDelete={() => onDelete(f)}
        />
      ))}
    </div>
  );
}

function FolderPill({
  folder, active, onSelect, onEdit, onDelete,
}: {
  folder: CollectionFolder;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-1.5 rounded-full pl-3 pr-2 py-1.5 text-sm font-medium transition-colors"
        style={{
          background: active ? 'var(--accent-soft)' : 'var(--surface)',
          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
          color: active ? 'var(--accent-text)' : 'var(--text)',
        }}
      >
        <span>{folder.name}</span>
        {folder.item_count != null && (
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {folder.item_count}
          </span>
        )}
        <span
          role="button"
          tabIndex={0}
          aria-label="Folder menu"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuOpen((o) => !o); } }}
          className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          ⋯
        </span>
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg py-1 text-sm shadow-xl"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
        >
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onEdit(); }}
            className="block w-full px-3 py-2 text-left hover:opacity-80"
            style={{ color: 'var(--text)' }}
          >
            {folder.is_default ? 'Edit description' : 'Edit collection'}
          </button>
          {!folder.is_default && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="block w-full px-3 py-2 text-left hover:opacity-80"
              style={{ color: '#E24B4A' }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FolderCardGrid({
  folders, onSelect, onEdit, onDelete,
}: {
  folders: CollectionFolder[];
  onSelect: (id: string) => void;
  onEdit: (f: CollectionFolder) => void;
  onDelete: (f: CollectionFolder) => void;
}) {
  const [previews, setPreviews] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const loadPreviews = async () => {
      const newPreviews: Record<string, string[]> = {};
      for (const folder of folders) {
        try {
          const res = await fetch(`/api/saves?folder_id=${folder.id}&limit=4`);
          if (!res.ok) continue;
          const data = await res.json();
          const saves: Save[] = data.saves ?? [];
          newPreviews[folder.id] = saves
            .filter((s) => s.image_url)
            .slice(0, 4)
            .map((s) => s.image_url as string);
        } catch {
          // silent
        }
      }
      setPreviews(newPreviews);
    };

    if (folders.length > 0) {
      loadPreviews();
    }
  }, [folders]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {folders.map((f) => (
        <FolderCard
          key={f.id}
          folder={f}
          previews={previews[f.id] ?? []}
          onSelect={() => onSelect(f.id)}
          onEdit={() => onEdit(f)}
          onDelete={() => onDelete(f)}
        />
      ))}
    </div>
  );
}

function FolderCard({
  folder, previews, onSelect, onEdit, onDelete,
}: {
  folder: CollectionFolder;
  previews: string[];
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <div
      onClick={onSelect}
      className="flex aspect-square flex-col items-start justify-end rounded-2xl overflow-hidden text-left transition-transform hover:scale-[1.02] relative group cursor-pointer"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {previews.length ? (
        <div className="absolute inset-0 grid grid-cols-2 gap-0.5 p-2 opacity-60 group-hover:opacity-75 transition-opacity">
          {previews.map((url, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={idx} src={url} alt="" className="w-full h-full object-cover rounded" />
          ))}
        </div>
      ) : null}

      <div
        ref={menuRef}
        className="absolute top-2 right-2 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Folder menu"
          className="flex h-7 w-7 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg py-1 text-sm shadow-xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
          >
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onEdit(); }}
              className="block w-full px-3 py-2 text-left hover:opacity-80"
              style={{ color: 'var(--text)' }}
            >
              {folder.is_default ? 'Edit description' : 'Edit collection'}
            </button>
            {!folder.is_default && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="block w-full px-3 py-2 text-left hover:opacity-80"
                style={{ color: '#E24B4A' }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 p-4 w-full flex flex-col items-start justify-end">
        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {folder.name}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {folder.item_count ?? 0} items
        </div>
      </div>
    </div>
  );
}

function FolderDescription({ folder, onEdit }: { folder: CollectionFolder; onEdit: () => void }) {
  if (!folder.description) {
    if (folder.is_default) return null;
    return (
      <button
        type="button"
        onClick={onEdit}
        className="text-sm underline-offset-2 hover:underline"
        style={{ color: 'var(--text-dim)' }}
      >
        + Add a description
      </button>
    );
  }
  return (
    <p
      className="text-sm leading-relaxed"
      style={{ color: 'var(--text-muted)' }}
    >
      {folder.description}
    </p>
  );
}

function EmptyState({
  search, isDefaultActive, activeFolderName, totalItems,
}: {
  search: string;
  isDefaultActive: boolean;
  activeFolderName: string | null;
  totalItems: number;
}) {
  let message: string;
  if (search) {
    message = `No items matching "${search}".`;
  } else if (totalItems === 0) {
    message = 'Nothing in your collection yet. Heart listings to add them here.';
  } else if (isDefaultActive) {
    message = 'My Collection is empty. Items you save go here by default.';
  } else {
    message = `No items in ${activeFolderName ?? 'this folder'} yet. Use the menu on any saved item to move it here.`;
  }
  return (
    <div
      className="rounded-2xl py-16 text-center text-sm"
      style={{ border: '1px dashed var(--border)', color: 'var(--text-dim)' }}
    >
      {message}
    </div>
  );
}

function SaveCard({
  save, onRemove, onMove,
}: {
  save: Save;
  onRemove: () => void;
  onMove: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isWatched, toggleWatch } = useWatchlist();
  const watched = isWatched(save.listing_url);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleHeart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove();
  };

  const handleEye = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const asListing = {
      id: save.id,
      title: save.title,
      price: save.price,
      currency: save.currency,
      condition: save.condition,
      size: null,
      seller: save.seller,
      url: save.listing_url,
      image: save.image_url,
      platform: save.platform,
    };
    toggleWatch(asListing);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((o) => !o);
  };

  return (
    <a
      href={save.listing_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl transition-all hover:opacity-90 hover:scale-[1.02]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {save.image_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={save.image_url}
            alt={save.title}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            No image
          </div>
        )}
        <button
          type="button"
          onClick={handleHeart}
          aria-label="Remove from saves"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ background: 'rgba(0, 0, 0, 0.55)' }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#E24B4A"
            stroke="#E24B4A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleEye}
          aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
          className="absolute flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ right: '0.5rem', top: '3rem', background: 'rgba(0, 0, 0, 0.55)' }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={watched ? 'var(--accent)' : '#ffffff'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" fill={watched ? 'var(--accent)' : 'none'} />
          </svg>
        </button>

        <div ref={menuRef} className="absolute left-2 top-2">
          <button
            type="button"
            onClick={handleMenuToggle}
            aria-label="More options"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
            style={{ background: 'rgba(0, 0, 0, 0.55)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg py-1 text-sm shadow-xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
            >
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onMove(); }}
                className="block w-full px-3 py-2 text-left hover:opacity-80"
                style={{ color: 'var(--text)' }}
              >
                Add to folder
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onRemove(); }}
                className="block w-full px-3 py-2 text-left hover:opacity-80"
                style={{ color: '#E24B4A' }}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <PlatformBadge platform={save.platform} className="self-start" />
        <p
          className="line-clamp-2 text-[13px] leading-snug"
          style={{ color: 'var(--text)' }}
          title={save.title}
        >
          {save.title}
        </p>
        {save.condition && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {save.condition}
          </p>
        )}
        <p className="mt-auto pt-1 text-[10px]" style={{ color: 'var(--text-dim)' }}>
          {PLATFORM_NAMES[save.platform] ?? save.platform} · saved {new Date(save.saved_at).toLocaleDateString()}
        </p>
      </div>
    </a>
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

function FolderEditModal({
  mode, onClose, onSubmit, folders,
}: {
  mode: FolderEditMode;
  onClose: () => void;
  onSubmit: (payload: { name: string; description: string }) => void;
  folders: CollectionFolder[];
}) {
  const isEdit = mode.kind === 'edit';
  const folder = mode.kind === 'edit' ? mode.folder : null;
  const isDefault = folder?.is_default ?? false;

  const [name, setName] = useState(folder?.name ?? '');
  const [description, setDescription] = useState(folder?.description ?? '');
  const [submitting, setSubmitting] = useState(false);

  const currentFolderId = folder?.id ?? null;
  const isDuplicate = !isDefault && name.trim().length > 0 && folders.some(
    (f) => !f.is_default && f.id !== currentFolderId && f.name.toLowerCase() === name.trim().toLowerCase()
  );
  const canSubmit = isDefault ? true : (name.trim().length > 0 && !isDuplicate);
  const title = isEdit ? (isDefault ? 'Edit My Collection' : 'Edit collection') : 'New collection';

  const handleSubmit = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    onSubmit({ name: name.trim(), description: description.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          {title}
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

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            maxLength={60}
            disabled={isDefault}
            autoFocus={!isDefault}
            className="input-base w-full rounded-lg px-3 py-2 text-sm"
            style={isDefault ? { opacity: 0.6 } : undefined}
          />
          {isDefault && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              My Collection&apos;s name can&apos;t be changed.
            </p>
          )}
          {isDuplicate && (
            <p className="mt-1 text-[11px]" style={{ color: '#E24B4A' }}>
              A collection with this name already exists.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Description <span style={{ color: 'var(--text-dim)' }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What kind of items belong here?"
            maxLength={280}
            rows={3}
            autoFocus={isDefault}
            className="input-base w-full rounded-lg px-3 py-2 text-sm"
          />
          <p className="mt-1 text-right text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {description.length}/280
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isEdit ? 'Save' : 'Create folder'}
        </button>
      </div>
    </ModalShell>
  );
}

function FolderDeleteModal({
  folder, onClose, onConfirm,
}: {
  folder: CollectionFolder;
  onClose: () => void;
  onConfirm: (cascade: boolean) => void;
}) {
  const itemCount = folder.item_count ?? 0;
  const [choice, setChoice] = useState<'keep' | 'cascade' | null>(
    itemCount === 0 ? 'keep' : null
  );
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = () => {
    if (choice === null || submitting) return;
    setSubmitting(true);
    onConfirm(choice === 'cascade');
  };

  const isCascade = choice === 'cascade';

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          Delete &quot;{folder.name}&quot;
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
        {itemCount > 0
          ? `This folder has ${itemCount} ${itemCount === 1 ? 'item' : 'items'}. What should happen to them?`
          : 'This folder is empty. Nothing else will change.'}
      </p>

      <div className="flex flex-col gap-2">
        <DeleteChoice
          selected={choice === 'keep'}
          accent="accent"
          title="Delete collection, keep items"
          subtitle="Items stay in My Collection."
          onSelect={() => setChoice('keep')}
          disabled={submitting}
        />
        <DeleteChoice
          selected={choice === 'cascade'}
          accent="destructive"
          title="Delete collection and items permanently"
          subtitle={
            itemCount > 0
              ? `Removes ${itemCount} ${itemCount === 1 ? 'item' : 'items'} from your collection.`
              : 'Nothing to remove. Folder is empty.'
          }
          onSelect={() => setChoice('cascade')}
          disabled={submitting || itemCount === 0}
        />
      </div>

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
          disabled={choice === null || submitting}
          className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={
            isCascade
              ? { background: '#E24B4A', color: '#fff' }
              : { background: 'var(--accent)', color: '#fff' }
          }
        >
          {submitting
            ? 'Deleting…'
            : isCascade
              ? 'Delete permanently'
              : 'Confirm delete'}
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteChoice({
  selected, accent, title, subtitle, onSelect, disabled,
}: {
  selected: boolean;
  accent: 'accent' | 'destructive';
  title: string;
  subtitle: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const ringColor = accent === 'destructive' ? '#E24B4A' : 'var(--accent)';
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50"
      style={{
        background: selected ? 'var(--accent-soft)' : 'var(--surface)',
        border: `1px solid ${selected ? ringColor : 'var(--border)'}`,
        color: 'var(--text)',
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={{ border: `2px solid ${selected ? ringColor : 'var(--border-strong)'}` }}
      >
        {selected && (
          <span className="h-2 w-2 rounded-full" style={{ background: ringColor }} />
        )}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}

function SaveDeleteModal({
  save, onClose, onConfirm,
}: {
  save: Save;
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
          Remove &quot;{save.title}&quot;?
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
        This item will be removed from your collection.
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
