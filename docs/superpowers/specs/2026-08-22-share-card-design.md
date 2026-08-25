# Share card — design spec

**Status:** Approved for planning. Not implemented.
**Date:** 2026-08-22

## Problem / context

Crawli has no share mechanism today (verified: no `share`/`referral` code anywhere in
`app`/`lib`). The founder wants a simple, non-incentivized share artifact, not a referral
program: a clean static image card a user can post showing what Crawli found for them.

This is deliberately scoped small. Prior analysis in this session (see chat) concluded a
referral/incentive program is premature at 59 users with zero non-owner conversions and a
one-search-then-leave retention pattern (`COMPETITIVE_POSITIONING.md` F9). A share card that
costs almost nothing to build and that fires on the very first search someone runs is the
cheap version of this idea worth testing — it doesn't require an existing retained user base,
since every user who runs any search reaches the trigger.

## Goals

- Generate a shareable PNG image showing: how many listings were found, how many
  marketplaces they came from, and the cheapest match's photo + price.
- Trigger it on the search-results page, for every user, every search.
- Make it as easy as possible to actually get the image out to a friend (native share sheet
  where supported, download otherwise).
- Zero new persistence, zero new incentive logic, zero new DB tables.

## Non-goals (explicitly deferred, not part of this plan)

- **Alert-match card variant.** The user confirmed "both, search first" — alerts is a
  fast-follow once alert engagement improves (F13: alert emails are barely opened today, so
  there's no volume to justify building the alert variant yet). Note it as future work only.
- **Referral/incentive credits for sharing.** Not part of this feature. See prior chat
  analysis — credits are a live paid SKU (`lib/creditPacks.ts`) and there's no retained
  cohort yet to calibrate a reward against.
- **A public shareable landing page per card** (i.e. a persisted, linkable URL someone else
  can click through to). This ships as an image only. No view tracking, no DB row per card.
- **Any new analytics/event logging.** Out of scope for v1; can be added later cheaply if
  wanted.

## Trigger & placement

- Lives on the search-results page (`ResultsDisplay.tsx`), same area as the existing
  `AlertCtaBanner`/`PriceSummary` panels — appears whenever a search returns at least one
  result. No threshold gating (e.g. "only if 10+ results") — keep it simple, always show it
  once there's something to show.
- A new `ShareFindButton.tsx` component. On click:
  1. Compute the cheapest listing from the results already loaded client-side (no new
     fetch for source data — the listings and their prices are already on the page).
  2. Build the share-card image URL (see API below) from that listing + the aggregate
     count/platform numbers.
  3. Fetch that URL as a blob, then:
     - If `navigator.canShare({ files: [...] })` is supported (most mobile browsers),
       call `navigator.share()` with the image file and a short text caption — this pops
       the native OS share sheet (Messages, Instagram, etc.) directly.
     - Otherwise, fall back to a plain `<a download>` trigger so the user saves the PNG
       and shares it manually.
  4. Show a small preview (the generated image) before sharing/downloading, so the user
     sees what they're about to post rather than sharing blind.

This is my call on the share mechanism (the user's clarifying question on this got
interrupted before they answered) — flagging it explicitly so it can be overridden when
this spec is reviewed.

## Card content

- Query text (e.g. "carhartt wip jacket")
- Result count: the number of listings actually shown to the user for that search (i.e.
  post relevance-filter, post tier cap — the honest number the user is looking at, not a
  theoretical uncapped count)
- Platform count: number of distinct marketplaces represented in that result set
- Featured listing = **cheapest match** among the results: its photo, price + currency,
  and platform name
- Crawli wordmark + URL in a footer. Explicit branding is fine — the obfuscation rule in
  CLAUDE.md was superseded 2026-08-19; openly branded content is the current norm.

**Copy constraints (claim ledger, `COMPETITIVE_POSITIONING.md` §6b):**
- State the cheapest listing's price as a fact ("$45 · Grailed"), never as a superlative
  ("best price", "lowest price guaranteed") — C6 ("best price on a secondhand item") is
  already a falsified wedge; don't reintroduce it here.
- No blended/cross-platform price claim — this card shows one listing's real price, not
  an aggregate, so this shouldn't be an issue as long as copy stays literal.

**Format:** 1080×1350 (4:5), matching the existing marketing-carousel default in
CLAUDE.md, for consistency with how Crawli images already look when posted.

## Rendering approach

Server-side generation via **`next/og`'s `ImageResponse`** (Satori-based), the standard
Next.js pattern for OG-image-style generation — no headless browser, no new heavy
dependency (Playwright is already a dependency for scraping, but spinning it up per
share-card request would be slow and heavyweight for a simple text+image layout).

- New route, e.g. `app/api/share-card/route.tsx`, `GET`, stateless — all card content
  passed via URL search params (query, count, platformCount, price, currency, platform,
  imageUrl, title). No DB write, nothing to persist or clean up.
- The listing's photo URL is a public marketplace CDN URL already shown to the user on
  the results page — Satori fetches it server-side directly, no proxying needed.
- **Fallback required:** if the upstream image fetch fails or times out (dead link,
  hotlink-protected CDN), render a plain placeholder block instead of erroring the whole
  route. Wrap the fetch/render in a try/catch.
- Sanitize/truncate title and query text to fixed max lengths so a long title can't break
  the layout. All text renders as plain JSX text nodes (no `dangerouslySetInnerHTML`), so
  standard escaping applies — no injection risk from listing titles.
- 400 on missing/invalid required params.

## Error handling

- Missing or malformed query params → 400 from the route, caught client-side, share
  button shows an inline "couldn't generate image, try again" state rather than a silent
  failure.
- Upstream photo fetch failure → placeholder image inside the card (route still returns
  200 with a valid PNG), not a route failure.
- `navigator.share` rejection/cancellation (user closes the share sheet) → no error
  surfaced, this is normal user behavior.

## Testing

- `npx tsc --noEmit` clean.
- Manual browser check per CLAUDE.md checklist: light + dark mode for the button/preview
  UI (the generated PNG itself doesn't need dark-mode variants — it's a static export).
- Verify the image renders correctly for a real query with results.
- Verify the fallback placeholder path when a listing photo URL is unreachable/404s.
- Verify the Web Share API path on an actual mobile browser and the download fallback on
  desktop.

## Open questions for the plan/implementation phase

- Exact caption text pre-filled into `navigator.share`'s `text` field.
- Whether the preview modal needs its own "regenerate with a different listing" control,
  or cheapest-match-only is fine for v1 (leaning: cheapest-only, YAGNI).
