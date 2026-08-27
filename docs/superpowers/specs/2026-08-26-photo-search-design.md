# Photo search: auto-fill query from a photo (design)

**Author:** Claude (brainstorming session with Kevin) · **Date:** 2026-08-26
**Status:** approved by Kevin, pending implementation plan

## Context

`docs/marketing/audience/profile.md`'s "day in their life" evidence: this
audience already uses Google Lens **in person**, mid-conversation at a garage
sale, on a physical item, to identify and price-check something on the spot.
That is the actual moment of use, not sitting down to type a query. Crawli has
no way to meet that moment today; the only input is a text box.

Two shapes were considered for a photo feature. **Reverse image match against
live listings** (photo → find visually similar items currently for sale) was
ruled out: it requires a new persistent image index over live listings, which
contradicts Crawli's deliberately live/on-demand search architecture
(`docs/core/SYSTEM_DESIGN.md`), and it is literally Gem's core differentiator
per `COMPETITIVE_POSITIONING.md` ("unwinnable against ... Gem (image search,
real-time alerts)"). Building it would mean building a worse, under-resourced
copy of the exact thing the 2026-08-07 strategy reset was designed to avoid
competing on.

**Identify-then-search** was chosen instead: a photo becomes a text query via
a vision model, then runs through the existing `/api/search` pipeline
unchanged. This has no image index, no new storage, and reuses everything
Crawli already has for search. Kevin's explicit requirements from
brainstorming: keep the model's guess **general** (garment type/color/style
over a specific niche-brand guess, since a wrong specific guess is worse than a
safe general one), **auto-fill only**, never auto-run the search, and leave
the field editable so the user can correct or extend it before searching
themselves. OCR (reading a physical tag) was discussed and explicitly dropped
for v1, general visual description only.

## What already supports this, so the change is smaller than it looks

- **The sidecar already does exactly this shape of LLM call.** `/expand-query`
  (`crawl4ai-service/main.py:1045-1092`) calls `litellm.acompletion()` against
  a provider resolved by `resolve_llm()` (`main.py:435-448`), which reads a
  single `LLM_PROVIDER` env var (e.g. `openai/gpt-4o-mini`, per the comment in
  `lib/queryExpansion.ts`) and looks up its key via `_PROVIDER_KEY_ENV` (line
  426, `{"openai": "OPENAI_API_KEY", ...}`). No new provider, no new key: a
  vision-capable model on the same provider slots into the same mechanism:
  `litellm` accepts an `image_url` content block in the user message exactly
  like OpenAI's own multimodal API, and translates it if the configured
  provider is a different one.
- **`lib/scraper.ts` already has the proxy pattern.** Every sidecar call from
  Next.js (`/scrape-search`, `/refresh-price`, `/scrape`) is a `fetch` against
  `${SIDECAR_URL}` (`CRAWL4AI_URL` env var, `lib/scraper.ts:3`) with a JSON
  body. The new endpoint follows the same shape, no new HTTP client, no new
  auth pattern.
- **`SearchForm.tsx` already owns the exact state to fill.** `query` is a
  plain `useState(initQuery)` (`app/components/SearchForm.tsx:97`) bound to the
  visible text input. Filling it from a photo result is the same operation as
  filling it by typing, no new state, no new submit path.

## Model choice

`openai/gpt-5-nano` (confirmed vision-capable via OpenRouter's live model
catalog, $0.05/$0.40 per 1M tokens in/out, cheaper than the current
`gpt-4o-mini` and newer-generation). Recommend bumping the sidecar's
`LLM_PROVIDER` env var from its current `openai/gpt-4o-mini` to
`openai/gpt-5-nano`, this is an env var change, not code, and it improves
`/expand-query` too, since both endpoints share the same global model config.
No second provider key. If independent model choice per endpoint is ever
wanted (e.g. a stronger model for photos than for text expansion), that is a
follow-up (a second env var, `resolve_llm()` taking a param), not needed for
v1, and not built speculatively.

## What has to actually change

### 1. New sidecar endpoint, `crawl4ai-service/main.py`

`POST /identify-photo`, modeled directly on `/expand-query`
(`main.py:1045-1092`):

- Request: `{"image": "<base64 JPEG, no data: prefix>"}`, a new
  `IdentifyPhotoRequest` Pydantic model, sibling to `ExpandQueryRequest`
  (`main.py:693-694`).
- Same `resolve_llm()` call, same `litellm.acompletion()` call shape, but the
  user message content is `[{"type": "text", "text": <system-style prompt>},
  {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{...}"}}]`
  instead of `/expand-query`'s plain text content.
- Response: `{"query": "<short suggested search string>"}`, a new
  `IdentifyPhotoResponse`, not `ExpandQueryResponse`'s alias-map shape.
- **No caching.** `/expand-query` caches in `_expand_cache` because the same
  normalized text query repeats across users; a photo is one-off per request,
  so there is nothing to key a cache on and nothing worth caching.
- **Failure is visible, not silent.** `/expand-query` swallows failures and
  returns an empty result (`main.py:1088-1091`) because it's enrichment on top
  of a query that already works without it. `/identify-photo` has no fallback
  behavior, its entire output is the one query string, so a failure (timeout,
  `resolve_llm()` returning `None`, a malformed image) must surface to the
  caller as an error response, which the UI turns into a toast. Silently
  returning nothing here would look like the button did nothing.
- Prompt instructs a short, general description suitable as a marketplace
  search query: garment type, color, notable silhouette/pattern. **Revised
  2026-08-27 after real-world testing** found two failures: a photo of a full
  outfit returned a combined multi-item query Crawli can't search, and the
  model dropped a clearly legible "SUPREME" wordmark in favor of a generic
  description. The prompt now explicitly picks the single most prominent item
  when several are visible, and separates reading printed text/logos that are
  actually visible on the item (do it, not a guess) from inferring a brand
  from style/silhouette alone (stay general there, per Kevin's original
  preference).

### 2. New Next.js API route, `app/api/search/identify-photo/route.ts`

Thin proxy to the sidecar, following the exact pattern already in
`lib/scraper.ts` (fetch `${SIDECAR_URL}/identify-photo`, forward the body,
return the JSON). Auth-gated the same way other authenticated API routes in
this app are.

### 3. UI, `app/components/SearchForm.tsx`

- A camera/upload affordance next to the existing text input. A single
  `<input type="file" accept="image/*" capture="environment">` covers both
  mobile camera capture and desktop file picking with no separate code paths.
  **Revised 2026-08-27:** an icon-only button with a hover title tested as
  unclear to a new user, and hover titles don't exist on mobile at all, the
  feature's primary use case per `profile.md`. The button now carries a
  visible "Photo search" text label alongside the icon.
- **Client-side resize before upload.** No existing precedent in-repo for this
  (the avatar upload in `EditProfileModal.tsx` sends the file as-is); this
  needs new, small utility code, draw to an offscreen canvas, downscale to a
  max dimension (~1024px long edge), re-encode as JPEG (~0.8 quality), then
  base64-encode. This keeps the request payload and the image-token cost down;
  the model doesn't need full phone-camera resolution to describe a garment.
- On a successful `/api/search/identify-photo` response, set the existing
  `query` state (`SearchForm.tsx:97`) to the returned string. **Do not call
  the existing submit/search handler.** The user sees the filled, editable
  text box and presses the existing search button themselves.
- On failure, `toast` (already imported, `SearchForm.tsx:17`) with a short
  error, consistent with how other failures in this component are already
  surfaced.

## Explicitly out of scope for v1

- OCR / reading a physical tag, discussed, dropped by Kevin for v1.
- Reverse image match against live listings (Option B), parked; would need
  its own strategy conversation given the direct overlap with Gem's
  positioning, not folded into this feature.
- Auto-running the search from the photo result.
- Persisting the uploaded photo anywhere (processed in-memory, discarded after
  the LLM call).
- A cache for photo results.
- Per-endpoint model configuration (photos vs. text expansion), both share
  `LLM_PROVIDER` for now.

## Testing

Manual, given the small footprint: a real photo of a mainstream item and one
of a niche/streetwear item, confirming (a) the query field fills and is
editable, (b) nothing auto-submits, (c) a forced failure (e.g. sidecar down)
shows a toast rather than silently doing nothing, and (d) the existing
type-a-query search flow is untouched. No new automated suite, this is a thin
addition on top of already-tested search infrastructure, mirroring how
`/expand-query` itself has no dedicated test file.
