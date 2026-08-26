'use client';

import { useState } from 'react';
import { buildShareCardUrl, type ShareCardData } from '@/lib/shareCard';
import ShareCardPreviewModal from './ShareCardPreviewModal';

/**
 * Results-page share affordance.
 *
 * Fetches the generated card from /api/share-card as a blob, previews it, then
 * hands it to the native OS share sheet where the browser supports sharing
 * files, falling back to a plain download everywhere else.
 *
 * No incentive, no referral code, nothing persisted. The artifact is the
 * whole feature.
 */

interface Props {
  data: ShareCardData | null;
}

const FILE_NAME = 'crawli-find.png';

function ShareIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

/** Probes for file-sharing support once, as a lazy initializer rather than an
 *  effect (this repo lints setState-in-effect as an error). Returns false on the
 *  server, where navigator does not exist. That is not a hydration hazard: the
 *  only thing this value affects is the preview modal's button label, and the
 *  modal does not exist until the user has generated a card. */
function useCanShareFiles(): boolean {
  const [canShare] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    try {
      const probe = new File([new Blob([''], { type: 'image/png' })], FILE_NAME, {
        type: 'image/png',
      });
      return Boolean(navigator.canShare?.({ files: [probe] }));
    } catch {
      return false;
    }
  });
  return canShare;
}

export default function ShareFindButton({ data }: Props) {
  const [loading, setLoading] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canShareFiles = useCanShareFiles();

  if (!data) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildShareCardUrl(data));
      if (!res.ok) throw new Error('share-card generation failed');
      setBlob(await res.blob());
    } catch {
      setError("Couldn't generate the image, try again");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!blob) return;
    setSharing(true);
    try {
      const file = new File([blob], FILE_NAME, { type: 'image/png' });
      if (canShareFiles) {
        const listings = data.totalCount === 1 ? 'listing' : 'listings';
        const marketplaces = data.platformCount === 1 ? 'marketplace' : 'marketplaces';
        await navigator.share({
          files: [file],
          text: `"${data.query}": ${data.totalCount} ${listings} across ${data.platformCount} ${marketplaces}, found with Crawli`,
        });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = FILE_NAME;
        a.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      // Cancelling the native share sheet rejects: that is normal, not an error.
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <ShareIcon />
          {loading ? 'Generating…' : 'Share your find'}
        </button>
        {error && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {error}
          </span>
        )}
      </div>
      {blob && (
        <ShareCardPreviewModal
          blob={blob}
          sharing={sharing}
          downloadOnly={!canShareFiles}
          onClose={() => setBlob(null)}
          onShare={handleShare}
        />
      )}
    </>
  );
}
