import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase/admin';

const OPENROUTER_MODEL = 'google/gemini-3.1-flash-lite-image';
const STORAGE_BUCKET = 'social-media-posts';

// Toddler/kids/baby sizing tokens seen in scraped listing titles. Matched as
// whole words (or the NT size pattern) so e.g. "5T" doesn't match "5TB".
const KIDS_SIZE_PATTERN =
  /\b(\d{1,2}T|kids?|toddler|infant|baby|babies|youth|junior|newborn)\b/i;

export function isKidsSize(title: string): boolean {
  return KIDS_SIZE_PATTERN.test(title);
}

async function fetchAsBuffer(url: string, timeoutMs: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function generateTryOnImage(garmentBuffer: Buffer, title: string): Promise<Buffer> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const prompt =
    `Using the exact garment shown in the reference photo (${title}), generate an ` +
    'aesthetic Pinterest-style outfit photo of a person wearing this exact garment: ' +
    'candid lifestyle fashion photography, warm soft filtered film tones, natural ' +
    'directional light, slightly moody editorial look. Frame the shot from the ' +
    'shoulders or chest down only — no head or face in frame at all, the garment ' +
    'itself is the subject. Portrait orientation (taller than wide), leave a little ' +
    "empty space at the top and bottom so nothing is cropped. Preserve the garment's " +
    'exact print, color, and design details as shown in the reference photo as closely ' +
    'as possible. Do not add text overlays.';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${garmentBuffer.toString('base64')}` },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`OpenRouter request failed: ${res.status}`);

  const data = await res.json();
  const images = data?.choices?.[0]?.message?.images;
  const dataUrl: string | undefined = images?.[0]?.image_url?.url;
  if (!dataUrl) throw new Error('OpenRouter returned no image');

  const b64 = dataUrl.split(',')[1];
  if (!b64) throw new Error('OpenRouter image response malformed');
  return Buffer.from(b64, 'base64');
}

// Pinterest's recommended pin aspect ratio.
const CANVAS_W = 1000;
const CANVAS_H = 1500;

async function compositeWithInset(modelBuffer: Buffer, garmentBuffer: Buffer): Promise<Buffer> {
  // 'contain' (never 'cover') so the generated shot is never cropped —
  // letterboxing with a neutral background is preferable to cropping the garment.
  const base = await sharp(modelBuffer)
    .resize(CANVAS_W, CANVAS_H, {
      fit: 'contain',
      background: { r: 245, g: 245, b: 245, alpha: 1 },
    })
    .toBuffer();

  const insetW = Math.round(CANVAS_W * 0.42);
  const border = 8;
  const margin = 24;

  const garmentResized = await sharp(garmentBuffer)
    .resize(insetW, insetW, { fit: 'inside' })
    .toBuffer();
  const garmentMeta = await sharp(garmentResized).metadata();
  const insetH = garmentMeta.height ?? insetW;

  const bordered = await sharp({
    create: {
      width: insetW + border * 2,
      height: insetH + border * 2,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: garmentResized, left: border, top: border }])
    .png()
    .toBuffer();

  const borderedMeta = await sharp(bordered).metadata();
  const boxW = borderedMeta.width!;
  const boxH = borderedMeta.height!;

  return sharp(base)
    .composite([
      {
        input: bordered,
        left: CANVAS_W - boxW - margin,
        top: CANVAS_H - boxH - margin,
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function uploadComposite(buffer: Buffer): Promise<string> {
  const admin = createAdminClient();
  const path = `pinterest/${randomUUID()}.jpg`;
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export interface PinterestPostImageResult {
  imageUrl: string;
  generated: boolean;
}

/**
 * Builds the "model wearing it" + garment-inset composite for a Pinterest pin.
 * Never throws — any failure (kids sizing, generation error, compositing
 * error, upload error) falls back to the original listing photo so the pin
 * always has an image.
 */
export async function generatePinterestPostImage(
  originalImageUrl: string,
  title: string,
): Promise<PinterestPostImageResult> {
  if (isKidsSize(title)) {
    return { imageUrl: originalImageUrl, generated: false };
  }

  try {
    const garmentBuffer = await fetchAsBuffer(originalImageUrl, 15_000);
    const modelBuffer = await generateTryOnImage(garmentBuffer, title);
    const composite = await compositeWithInset(modelBuffer, garmentBuffer);
    const publicUrl = await uploadComposite(composite);
    return { imageUrl: publicUrl, generated: true };
  } catch (err) {
    console.error('[pinterestImage] generation failed, falling back to original photo:', err);
    return { imageUrl: originalImageUrl, generated: false };
  }
}
