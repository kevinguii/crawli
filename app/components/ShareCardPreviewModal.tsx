'use client';

import { useEffect, useState } from 'react';

/**
 * Presentational preview for a generated share card.
 *
 * Owns its own object-URL lifecycle so no caller has to think about
 * createObjectURL/revokeObjectURL. Overlay behaviour (click-outside, Escape,
 * body scroll lock) mirrors MoveToFolderModal.
 */

interface Props {
  /** Non-nullable by design: the caller mounts this only once it has a blob, so
   *  the object URL below can be created once per mount as a pure lazy init
   *  rather than synced from an effect. */
  blob: Blob;
  sharing: boolean;
  /** True when the browser cannot share files, so the action is a download. */
  downloadOnly: boolean;
  onClose: () => void;
  onShare: () => void;
}

export default function ShareCardPreviewModal({
  blob,
  sharing,
  downloadOnly,
  onClose,
  onShare,
}: Props) {
  const [objectUrl] = useState(() => URL.createObjectURL(blob));

  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl p-5 shadow-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Share your find
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

        {/* eslint-disable-next-line @next/next/no-img-element -- blob object URL, not a static asset */}
        <img
          src={objectUrl}
          alt="Preview of the image you are about to share"
          className="max-h-[60vh] w-full rounded-xl object-contain"
        />

        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {sharing ? 'Preparing…' : downloadOnly ? 'Save image' : 'Share'}
        </button>
      </div>
    </div>
  );
}
