import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SIDECAR_URL = process.env.CRAWL4AI_URL ?? 'http://localhost:8000';

// Proxies a photo to the sidecar's /identify-photo (litellm vision call) and
// returns each distinct item it found as a short suggested search query.
// Auto-fill only: the caller decides whether/when to actually run a search
// with any of them.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const image: string = typeof body?.image === 'string' ? body.image : '';
  if (!image) return NextResponse.json({ error: 'missing image' }, { status: 400 });

  try {
    const res = await fetch(`${SIDECAR_URL}/identify-photo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'photo identification failed' }, { status: 502 });
    }

    const data = (await res.json()) as { items?: string[] };
    return NextResponse.json({ items: data.items ?? [] });
  } catch (err) {
    console.error('[/api/search/identify-photo POST] sidecar error', err);
    return NextResponse.json({ error: 'photo identification failed' }, { status: 502 });
  }
}
