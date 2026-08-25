import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT } from '@/lib/shareCard';
import { PLATFORM_NAMES } from '@/lib/types';

// Node runtime (default) — the app is self-hosted on Node (Hetzner), not edge,
// same as app/opengraph-image.tsx.

const MAX_TITLE_LENGTH = 80;
const MAX_QUERY_LENGTH = 60;
const IMAGE_FETCH_TIMEOUT_MS = 4000;

// Brand gradient, mirrors app/opengraph-image.tsx and the Hero/Wordmark gradient.
const GRADIENT = 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)';

const PHOTO_HEIGHT = 620;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1).trimEnd() + '…' : value;
}

/** The query is rendered on its own line rather than inlined into the headline,
 *  so a query like "stussy tee" never has to agree in number with the count
 *  ("Found 47 stussy tee" was the earlier, ungrammatical version). */
function plural(raw: string, singular: string, pluralForm: string): string {
  return Number(raw) === 1 ? singular : pluralForm;
}

function formatPrice(rawPrice: string, currency: string): string {
  const amount = Number(rawPrice);
  if (!Number.isFinite(amount)) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unrecognized currency code — fall back rather than fail the whole card.
    return `${amount.toFixed(0)} ${currency}`.trim();
  }
}

/** Pre-validates the listing photo before handing it to Satori. A dead or
 *  hotlink-protected CDN url must fall back to a placeholder block instead of
 *  breaking image generation for the whole card. */
async function resolveImageUrl(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl) return null;
  try {
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    return type.startsWith('image/') ? rawUrl : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = params.get('query');
  const count = params.get('count');
  const platforms = params.get('platforms');
  const price = params.get('price');
  const currency = params.get('currency') ?? 'USD';
  const platform = params.get('platform');
  const title = params.get('title');
  const rawImage = params.get('image');

  if (!query || !count || !platforms || !price || !platform || !title) {
    return new Response('Missing required parameter', { status: 400 });
  }

  const imageUrl = await resolveImageUrl(rawImage);
  const priceLabel = formatPrice(price, currency);
  const platformLabel = PLATFORM_NAMES[platform] ?? platform;
  const safeTitle = truncate(title, MAX_TITLE_LENGTH);
  const safeQuery = truncate(query, MAX_QUERY_LENGTH);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#111110',
          fontFamily: 'sans-serif',
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '9999px',
              background: GRADIENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '26px',
              fontWeight: 700,
            }}
          >
            Cr
          </div>
          <div style={{ color: '#ffffff', fontSize: '32px', fontWeight: 700 }}>Crawli</div>
        </div>

        <div
          style={{
            display: 'flex',
            color: '#b8b6b0',
            fontSize: '30px',
            marginTop: '44px',
          }}
        >
          &ldquo;{safeQuery}&rdquo;
        </div>

        <div
          style={{
            display: 'flex',
            color: '#ffffff',
            fontSize: '50px',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-1px',
            marginTop: '12px',
          }}
        >
          {count} {plural(count, 'listing', 'listings')} across {platforms}{' '}
          {plural(platforms, 'marketplace', 'marketplaces')}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '44px',
            borderRadius: '24px',
            overflow: 'hidden',
            background: '#1c1b19',
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori renders this itself; next/image does not apply inside ImageResponse
            <img
              src={imageUrl}
              width={SHARE_CARD_WIDTH - 128}
              height={PHOTO_HEIGHT}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: `${SHARE_CARD_WIDTH - 128}px`,
                height: `${PHOTO_HEIGHT}px`,
                background: '#2a2926',
              }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '32px' }}>
            <div style={{ display: 'flex', color: '#ffffff', fontSize: '34px', fontWeight: 700 }}>
              {safeTitle}
            </div>
            <div style={{ display: 'flex', color: '#b8b6b0', fontSize: '28px', marginTop: '10px' }}>
              {priceLabel} · {platformLabel}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            color: '#77746e',
            fontSize: '24px',
            marginTop: 'auto',
          }}
        >
          via Crawli · thecrawli.com
        </div>
      </div>
    ),
    { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT },
  );
}
