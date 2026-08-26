// IndexNow: pushes "these URLs changed" notifications to Bing/Yandex/Naver so
// they recrawl promptly instead of waiting for an organic crawl. Submitting to
// api.indexnow.org auto-shares to all participating engines. Google does NOT
// participate, so this has no effect on Google indexing (that's driven via GSC).
//
// Protocol: POST JSON { host, key, keyLocation, urlList } to
// https://api.indexnow.org/indexnow. Up to 10,000 URLs per request. The key
// must match public/<key>.txt (the ownership proof file). See docs/core/PITFALLS.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thecrawli.com';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10_000;

/**
 * Notify IndexNow that the given absolute URLs changed. Best-effort only: any
 * failure (missing key, network error, non-2xx, localhost URLs the API rejects)
 * is logged and swallowed, this must never throw into a deploy step or the
 * compare-refresh cron. Returns true only on a confirmed 2xx submission.
 */
export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.warn('[indexnow] INDEXNOW_KEY not set, skipping submission');
    return false;
  }

  const urlList = urls.slice(0, MAX_URLS_PER_REQUEST);
  if (urlList.length === 0) return false;

  let host: string;
  try {
    host = new URL(SITE_URL).host;
  } catch {
    console.warn(`[indexnow] invalid NEXT_PUBLIC_SITE_URL: ${SITE_URL}`);
    return false;
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${SITE_URL}/${key}.txt`,
        urlList,
      }),
    });

    if (!res.ok) {
      // 400 invalid format, 403 key mismatch, 422 URL/host mismatch, 429 rate limit.
      console.warn(`[indexnow] submission returned ${res.status} for ${urlList.length} urls`);
      return false;
    }

    console.log(`[indexnow] submitted ${urlList.length} urls (${res.status})`);
    return true;
  } catch (err) {
    console.warn('[indexnow] submission failed:', err);
    return false;
  }
}
