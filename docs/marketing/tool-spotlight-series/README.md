# Crawli Tool Spotlight Series

A genuine "underrated tools" roundup carousel: each slide names one real, specific,
independently useful tool or trick, overlaid on a real photo — no icons, no dashboards, no
product screenshots. Distinct from both the fact-carousel format's rotating layouts
(`../POSTS_README.md`) and the Journey Series' narrative-story format
(`../journey-series/README.md`).

## Format

5-6 slides: hook (no eyebrow, grabby line, no branding) → 4-5 tool slides (small numbered
eyebrow + the tool's name as the headline + one supporting line explaining exactly how to
use it). Every tool slide gets the same plain treatment — no special reveal or punchline
styling on whichever slide names Crawli.

## Naming policy (deliberate departure from obfuscate-CI)

Pilot post 1 shipped first with every slide describing a vague, unnamed capability
("One search. Nine marketplaces.") and a soft Crawli aside on the close slide — the same
obfuscate-CI pattern the fact-carousel series uses. On review, this failed: a reader gets
nothing concrete out of a vague capability description with no product named, so it just
reads as ad-shaped with the ad content removed. It was rebuilt around a different premise:
**this series is a genuine "underrated tools" roundup.** Each slide names one real, specific,
independently useful tool or trick (Google Lens reverse-image check on a listing photo,
eBay's sold-listings filter, Google Trends) that a reader can act on immediately, with zero
relationship to Crawli. Crawli is named directly as one slide among these, given the exact
same plain, unhedged treatment as the other three — not hidden behind an aside, not a
"reveal" or punchline. The value proposition to the reader is "I just learned several real
things," and trust transfers from the genuine recommendations to the one named product.
This is a deliberate, per-series exception to the obfuscate-CI rule the rest of the project
follows (fact-carousel batches, `../POSTS_README.md`) — do not silently import it into other
series. No URL or "download" link appears on the slide itself; the plain name is the ask.

## Content policy

Whichever slide names Crawli must describe something Crawli actually ships — verified
against `docs/reference/B2B_FEATURE_TRUTH.md` and `HANDOFF.md` before writing, not invented
for the post. The other tool slides must be genuinely useful, real, and independently
verifiable (an actual product feature, an actual filter/setting that exists today) — not a
strawman or a made-up trick that doesn't really work, since the whole premise depends on
those recommendations being trustworthy on their own.

Pilot post 1 ("Tools Resellers Actually Use"): Google Lens reverse-image search on a listing
photo, eBay's sold-listings filter (advanced search → sold), Google Trends (checking whether
a "hot" niche is a real trend or one viral post), and Crawli (9-platform simultaneous search,
the real per-platform net profit calculator from `lib/marketplaceFees.ts`, and boolean
sourcing alerts from `lib/alertRunner.ts` — brand+size+price+keyword together).

## Photo policy

Real photography only, no AI generation — free, commercially-licensed stock (Unsplash
License / Pexels License), same policy as the Journey Series. Priority: clean, uncluttered
compositions. Avoid any photo with legible on-screen text/UI (lock screens, notification
banners, app text) since it visually competes with the overlaid caption — pilot post 1 hit
this exactly on an earlier draft of one slide (a busy lock-screen photo was swapped for a
plain silhouette shot after export review, then that slide's tool concept changed again in
the rebuild and the photo was swapped once more). Every post's `images/CREDITS.md` records
the source URL, photographer, and license per photo.

## Visual system — signature look (fixed across the series)

Font pairing: Satoshi (headings) + General Sans (small UI text), via the Fontshare CSS API
(`https://api.fontshare.com/v2/css?...`) — neither font is on Google Fonts. Layout:
full-bleed real photo + top/bottom scrim + centered-stacked text block (vertically centered,
not anchored to an edge) + small numbered eyebrow in the post's accent color. This
centered-stacked placement is what differentiates the series visually from the Journey
Series' bottom-anchor. Accent color: soft pink `#f472b6` for the pilot; future posts may vary
per-post per the normal `check-visual-diversity.js` unused-color rule, since — unlike the
Journey Series — this series does NOT fix one color across every post (only the font
pairing and layout/placement are fixed as the series signature).

## Batch index

| Date | Folder | Post | Subject |
|---|---|---|---|
| 2026-07-09 | `2026-07-09-pilot/` | 1 | Tools Resellers Actually Use |
| 2026-07-11 | `2026-07-11-luxury-authentication/` | 2 | Never Get Scammed On A Designer Piece (luxury authentication) |

## Caption format

Same TikTok title/description rules as the fact-carousel series (`../POSTS_README.md`
"Caption Format" section), except captions in this series name Crawli directly (see
"Naming policy" above) rather than following the fact-carousel obfuscate-CI caption rule.
Still no URL and no "download"/"link in bio" wording — the name alone is the ask.
