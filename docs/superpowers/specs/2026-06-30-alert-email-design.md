# Search alert email redesign

## Problem

Both alert emails sent via Resend are plain text only:
- `lib/alertRunner.ts` `sendAlertEmail()` — the real email, sent when a saved search finds new matches
- `app/api/saved-searches/test-email/route.ts` — a preview email with hardcoded sample listings

No HTML, no branding, no images, despite `newListings` in `alertRunner.ts` carrying full `Listing` objects (image, platform, price, currency, size, condition, color, url).

## Goal

Add an HTML version of the alert email that looks like a polished transactional email and reuses the brand system already defined in `app/globals.css` (red→orange→yellow gradient, accent `#E24B4A`).

## Design

### Shared template module

New file: `lib/email/alertEmailTemplate.ts`, exporting:

```ts
function buildAlertEmailHtml(params: {
  query: string;
  newCount: number;
  listings: Listing[]; // already sliced to the cap (5) by caller
  totalNewCount: number; // for "+N more" — may exceed listings.length
}): string
```

Both `lib/alertRunner.ts` (`sendAlertEmail`) and `app/api/saved-searches/test-email/route.ts` call this function and pass the result as the `html` field to `resend.emails.send()`, alongside the existing `text` field (kept as-is, serves as the plaintext part). The test-email route's hardcoded sample listings get extended with `image`/`platform`/`size`/`condition` fields so the preview matches a real card.

No other `/api/` logic changes — only the `text`/`html` payload passed to `resend.emails.send()` in the two existing call sites.

### Layout (table-based, fully inline-styled — required for email client rendering, no Tailwind classes or `<style>` blocks relied upon)

1. **Header bar** — solid `#E24B4A` background, full width. White bold "Crawli" wordmark text (no image — no raster logo exists, and SVG gradient text isn't reliably supported across clients). Small "Alert" label/tag next to it.
2. **Intro line** — on white body background: `Your alert for "{query}" found {N} new listing{s}:` in dark text (`#111110`).
3. **Listing cards** — one stacked row per listing (cap 5, matching current logic), each a 2-column inline table:
   - Left: 80×80 product thumbnail from `image`; if `image` is null, a neutral light-gray placeholder box instead (no broken-image icon)
   - Right: title (bold, single line, truncated via CSS), price (accent-red, currency-formatted — falls back to "Price unavailable" if null, matching current text logic), and a muted second line listing only the non-null fields among platform / size / condition, joined by " · "
   - Whole card row wrapped in an `<a href={url}>` so the entire card is clickable
   - If `totalNewCount > listings.length`, append a muted text row: "…and {totalNewCount - listings.length} more."
4. **CTA button** — solid accent-red button/link, "View all results" → `https://thecrawli.com/alerts`
5. **Footer** — light gray (`#f7f7f6`) background, muted text: "Manage your alerts" link → `https://thecrawli.com/alerts`, plus small plain-text "Crawli" wordmark. Low-contrast gray throughout, consistent with the existing "— Crawli" plaintext sign-off.

### Color/style choices

- Body background: white / `#f7f7f6` (light theme tokens) — not the app's dark theme, since dark-mode-background emails render unpredictably (some clients force light, causing dark-on-dark text). Brand gradient is reserved as an accent (header bar, CTA button) rather than the dominant surface.
- Typography: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) — matches the app's fallback stack; no custom webfont loading in email (unreliable across clients).
- Accent red `#E24B4A` for price text, CTA button, header bar — sourced directly from `--accent` / `--brand-red` in `app/globals.css`.

## Out of scope

- No changes to `/api/cron/run-alerts`, schema, or notification logic.
- No unsubscribe/CAN-SPAM footer beyond the "Manage your alerts" link (already sufficient — alerts are opt-in user-created searches, pausable from the same page).
- No raster logo asset creation — text wordmark only.
- No dark-mode-aware email styling (`prefers-color-scheme` media queries) — out of scope for this pass.

## Verification

- `npx tsc --noEmit` clean
- Send the test email (`POST /api/saved-searches/test-email`) to a real inbox and visually check Gmail web + Gmail mobile rendering at minimum
- Confirm image fallback (null `image`) renders the placeholder box, not a broken-image icon
- Confirm long titles truncate instead of breaking the layout
