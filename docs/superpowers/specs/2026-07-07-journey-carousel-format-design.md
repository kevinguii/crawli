# Journey carousel format (Pubity-style narrative series)

## Problem

Every carousel batch shipped so far (`docs/marketing/YYYY-MM-DD/`) is a listicle/fact format: hook cover → 4-6 step/myth/fact slides → CTA. There is no protagonist and no narrative tension — nothing to *follow*. Instagram accounts like Pubity get high engagement from a different mechanic: a single-person true story told in short, chronological, real-photo beats, opening on an unresolved hook and closing on a lesson. We want to adapt that mechanic to Crawli's secondhand-fashion niche, using real, documented resale/fashion journeys instead of fabricated ones.

This is a new content *format*, not a new topic in the existing fact-carousel rotation, so it gets its own series identity and its own folder rather than slotting into the dated batch pattern.

## Scope

Pilot: **one post**, Emma Rogue's real, publicly documented story (thrifted 90s platform Skechers that didn't fit her → posted on Depop → a bidding war → posted a TikTok showing how she packs orders → 6M views in a week, 40k new followers, 300 orders → opened the vintage store Rogue on NYC's Lower East Side). Sourced from i-D, Hypebae, Elite Daily (all cited in the caption).

Explicitly deferred: the second pilot arc (Wisdom Kaye / "where the pieces come from" angle) — not built until this first post is reviewed.

Files touched (new):
- `docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html` — 1 post, 8 slides
- `docs/marketing/journey-series/2026-07-07-pilot/post-captions.md` — 1 caption (existing TikTok title/description rules)
- `docs/marketing/journey-series/2026-07-07-pilot/images/` — sourced real photos + any fallback stock/AI, one file per slide
- `docs/marketing/journey-series/README.md` — short series-level doc: format rules, photo-sourcing policy, signature visual spec (so this doesn't live only in this spec file, matching how `POSTS_README.md` documents the fact-carousel format)

No changes to `export-slides.js` slide-type renderers if the new `journey-beat`/`journey-hook`/`journey-lesson` slide types can reuse existing CSS primitives (scrim, badge, content flex-box) already built for `cover-photo`. If a genuinely new layout primitive is needed, it's added as a new CSS block, not a rewrite of existing slide types.

## Format mechanics (adapted from Pubity)

8 slides:

1. **Hook** — real/stock photo + one unresolved-tension headline. No name yet. e.g. "She listed shoes that didn't even fit her. Then a bidding war started."
2. **Beat 1** — thrifted after gymnastics practice, with her mom. Photo + one line (5-12 words), no paragraphs.
3. **Beat 2** — found platform Skechers that didn't fit; listed them on Depop anyway.
4. **Beat 3** — a bidding war broke out. That's when she knew.
5. **Beat 4** — posted a TikTok of how she packs Depop orders.
6. **Beat 5** — 6M views in a week. 40k followers and 300 orders overnight.
7. **Lesson** — one bidding war became a real vintage store on the Lower East Side.
8. **Tie-in + source credit** — soft Crawli aside (decoupled from Emma's story — never implies she uses or endorses Crawli), plus a small citation line ("story reported by i-D, Hypebae, Elite Daily").

Text per beat stays concise — a caption line, not a paragraph, matching the Pubity mechanic of "swipe fast, absorb instantly."

## Protagonist & photo policy

Real name and real, publicly reported story facts are used under **editorial commentary**: we are retelling and citing an already-published, newsworthy story, not fabricating one or using someone's likeness to imply endorsement. This is why the citation on slide 8 matters — it's what keeps the whole post in commentary territory rather than unlicensed commercial use of a person's identity.

**Photos: real over AI, real over generic, in this priority order per beat:**
1. A real, credited press photo of Emma/the store (Camila Palacios / Hypebae has a full credited set of the store opening) — used with photographer/outlet credit.
2. A frame or screenshot from Emma's own public TikTok/Depop content, where the beat is directly about that specific post (the packing-orders TikTok is referenced/embedded by i-D covering this exact story) — this is real primary-source material and the strongest kind of "real" available for the pre-store beats.
3. A real (non-Emma) stock or creative-commons photo of the literal object/scene (e.g. 90s platform Skechers, a thrift rack) where no photo of the specific real moment exists — real photography, just not of her specifically.
4. AI-generated b-roll — **last resort only**, used solely for generic scene-setting (never a fabricated face of Emma), only when no usable real photo exists for that beat after an actual search.

Per-beat sourcing plan (confirmed via research on i-D, Hypebae, Elite Daily, Document Journal):

| Slide | Beat | Primary real source | Fallback |
|---|---|---|---|
| 1 | Hook (shoes tease) | Real stock photo, 90s platform Skechers | — |
| 2 | Thrifted w/ mom after gymnastics | Real (non-Emma) stock thrift-rack photo | AI only if no usable stock found |
| 3 | Listed the shoes on Depop | Real product/listing-style photo | — |
| 4 | Bidding war started | Real product/listing-style photo (reuse or variant) | — |
| 5 | Posted the packing-orders TikTok | Frame/screenshot from her actual public TikTok | — |
| 6 | 6M views, 40k followers, 300 orders overnight | Same TikTok frame or a real stats-screenshot treatment | — |
| 7 | Opened Rogue on the LES | Credited Camila Palacios / Hypebae press photo | — |
| 8 | Tie-in + credit | Same store photo or plain background | — |

No slide uses an AI-fabricated face of Emma under any circumstance.

## Visual system — signature series look

This series gets **one fixed look reused across every journey post** (font pairing, layout, "chapter/timeline" beat treatment), exempt from the fact-carousel batches' per-batch font/layout/placement rotation rule — the point is series recognizability, not per-batch novelty. Color may still vary per story so posts in the series aren't visually identical, just visually related.

Concrete font pairing, exact CSS layout, and color are picked during implementation (execution phase pulls from `ui-ux-pro-max`'s `typography.csv`, same as the fact-carousel workflow), constrained to: not yet used in any fact-carousel batch (checked against `visual-history.json`), and legible at small caption-line sizes since beats are short single lines, not headlines.

`visual-history.json` entries for this series get an added `"series": "journey"` field so `check-visual-diversity.js` treats this series as its own rotation track (must stay internally consistent) rather than forcing it to diverge from the fact-carousel batches.

## Caption format

Unchanged from the existing TikTok title/description rules (`POSTS_README.md` "Caption Format" section) — 90-char title, 150-400 word description, max 5 hashtags, obfuscated commercial intent (no URL/"search Crawli"/"download"/"link in bio"). One addition: the description names Emma Rogue and cites the source outlets (i-D, Hypebae, Elite Daily) — naming the real person and outlets is fine since it's the editorial-commentary anchor; only the Crawli product mention itself stays soft/implicit, per the existing obfuscate-CI rule.

## Out of scope (this pilot)

- The second arc (Wisdom Kaye / stylist angle) — not built until this post is reviewed.
- No changes to `export-slides.js` `SLIDE_COUNTS` mechanism beyond adding this new folder's entry when exporting.
- No Supabase `content_history` dedup needed — this is a new format/series, not pulled from the topic-brief rotation that table dedups against.
- No decision yet on cadence (how often journey posts ship relative to fact-carousel batches) — pilot is a single post to validate the format before any cadence commitment.

## Testing / verification

- Manual review in browser (arrow-key navigation, same as existing batches) before export.
- Confirm every real-photo slide has a credit noted (in an HTML comment or the images folder's file naming) so the caption citation stays accurate.
- Confirm slide 8's Crawli aside reads as genuinely decoupled from Emma's story on a fresh read (no sentence implies she used/endorsed Crawli).
- Export via `export-slides.js --batch=journey-series/2026-07-07-pilot` (the existing `--batch=` arg already resolves nested paths via `path.resolve`, no script changes needed) — verify no blank/undersized frames, same check prior batches have used. `SLIDE_COUNTS` in the script is updated to `[8]` for this one-post run.
- User reviews the rendered post before any posting/publishing step.
