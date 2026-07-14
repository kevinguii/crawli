import { NextRequest, NextResponse } from 'next/server';
import { generatePinterestPostImage } from '@/lib/pinterestImage';

export const dynamic = 'force-dynamic';
// Generation + compositing can take 20-30s.
export const maxDuration = 60;

/**
 * Called by the "pinterest crawli" n8n workflow right after a listing is
 * saved. Turns the raw listing photo into a "model wearing it" composite
 * with the original photo inset in the corner. Always returns 200 with an
 * imageUrl — falls back to the original photo on any failure so the pin
 * always posts (see lib/pinterestImage.ts).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[pinterest/generate-post-image] CRON_SECRET not set');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const imageUrl = body?.imageUrl;
  const title = body?.title;

  if (typeof imageUrl !== 'string' || typeof title !== 'string') {
    return NextResponse.json({ error: 'imageUrl and title are required' }, { status: 400 });
  }

  const result = await generatePinterestPostImage(imageUrl, title);
  return NextResponse.json(result);
}
