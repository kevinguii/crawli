# Crawli Journey Series

Pubity-style narrative carousels: one real, documented person's story told in short chronological beats, instead of the fact-carousel format's listicle structure.

There are two sub-formats. **The illustrated pipeline below is the current default** — use it unless the user asks for the original photo-only pilot format.

## Illustrated pipeline (current default, since 2026-07-13)

Cartoon/illustrated portraits of the real subject (AI-redrawn from a real reference photo), not straight photography. Lives **outside this repo**, on the user's Desktop at `~/Desktop/nano-banana-tests/<post-slug>/` — that folder is the actual pipeline; this doc is the instructions for operating it. Three posts built this way so far: Wisdom Kaye (`post1.zip` — an earlier manual run, kept zipped rather than as a loose folder), Emma Rogue (`emmarogue/`), Satu Tuohimaa (`satu-poshmark/`). Each post folder's `candidates/` (raw sourcing pool, mostly-unselected photo pulls) is zipped to `candidates.zip` once a batch ships — `images/` already holds the final selects, and `CREDITS.md` documents every source, so the zip is just cold storage in case sourcing needs revisiting.

### Format: 14 slides

`slide-00` (hook, no name yet) → `slide-01`–`slide-12` (12 body beats, one photo + one caption each) → `slide-13` (CTA).

Caption cadence, matched across all three posts so far:
- **Hook:** "How [a humble specific detail] became/turned into/built [the big outcome]" — no name.
- **Slide 01:** "Meet [Name], a [role] in [place]." — the name + origin reveal.
- **Body beats:** one or two declarative sentences, roughly 15–25 words each. Arc shape: origin → what made the platform/path work for them → a turning point/stakes beat → the "proof moment" broken into 2–3 slides (a specific find/decision → research/validation → the payoff, with real numbers) → a lesson/insight beat → wider process detail → a macro-validation beat (a market stat or social-proof roll call, mirroring "industry came calling" / celebrity-visitor beats) that closes the arc before the CTA.
- **CTA (slide-13):** names the specific dollar figure or detail from the story, then one Crawli line. No "link in bio," no URL, no "search Crawli" phrasing — same rule as the fact-carousel series (see `../POSTS_README.md`). The CTA slide is **not** AI-redrawn: plain black background + the real Crawli price-comparison screenshot asset (`assets/crawli-card.jpg`, reused across posts) + Crawli badge, built by `build_cta.py`, not `process.py`.

### Visual system

- Illustration style (`CARTOON_PROMPT` in `process.py`): clean confident black ink linework, flat cel-shaded blocks of color, light sketchy cross-hatching for depth — explicitly "looks like a drawing, not a photo," not painterly/photorealistic. This wording was tightened on 2026-07-13 after the user asked for something "more drawing like" than the original marker-and-ink pass.
- Full-bleed: the illustration is center-cropped to **cover** the full 1080-wide canvas (`paste_cover()`), not letterboxed with side/black bars. This was also a 2026-07-13 fix — the original version used `paste_contain()` and left too much black space.
- 4:5 Instagram (1080×1350), fixed. Caption band is a black bar at the bottom, serif caption font (Playfair Display, "elegant, not Impact/bold" per user feedback — the original Wisdom Kaye post used a bold sans that later posts moved away from), Crawli badge (`Cr`) between the art and the caption.
- Model: OpenRouter, `google/gemini-3.1-flash-lite-image` (the `"lite"` model in manifest entries). Key comes from the repo's `.env` (`OPENROUTER_API_KEY`) — export it into the shell before running `process.py` since the Desktop folder has no `.env` of its own.

### Real-face exception to the old photo policy

The original 2026-07-07 pilot's photo policy said "no AI generation, never a fabricated face of the real person." The illustrated pipeline deliberately overrides that for this sub-format: a real reference photo of the subject is always the AI-redraw input, so the output is an editorial illustration of a real, cited person (like a magazine profile illustration), not a fabricated likeness. Treat this as the current policy for the illustrated sub-format specifically — it does not relax anything for the original photo-only pilot format below.

### End-to-end workflow

1. **Check the source material.** If the user cites an article, fetch it (WebFetch; if the primary domain blocks fetching — e.g. financialpost.com refused — search for a syndicated mirror, like a Yahoo Finance re-post, and fetch that instead). Diff the fetched facts against the user's raw notes and report back anything they missed (exact names, numbers, dates, quotes) before drafting copy. Never invent a fact or a citation URL — if a detail can't be independently verified, keep it but don't attach a fabricated source link to it.
2. **Draft and lock the 14-slide caption copy** in the cadence above. If the user gives you an existing post to match tonally (e.g. "make sure it follows the wording of the X one"), read that post's actual manifest for the exact phrasing pattern rather than approximating from memory.
3. **Set up the post folder**: `~/Desktop/nano-banana-tests/<post-slug>/` with `images/`, `output/`, `candidates/`, `assets/fonts/`. Copy `process.py`, `build_cta.py`, and `assets/` verbatim from the most recent prior post folder — don't rewrite them from scratch, they're the working pipeline. Write `manifest.json`: one `{image, caption, model, notes}` entry per slide, `slide-00` through `slide-13`.
4. **Source photos.** For the real subject: try Playwright → Google Images (`site:unsplash.com <subject/topic>` or the subject's name directly) → `browser_evaluate` scraping `a[href*="unsplash.com/photos/"]` off the results page (Google doesn't hotlink Unsplash's CDN, so you need the photo page URLs, not `<img src>`) → download via `https://unsplash.com/photos/{id}/download?w=1400`. This endpoint rate-limits fast (expect some 403s after 3–4 rapid pulls) — space requests out, or reuse an already-vetted b-roll image from a prior post's `candidates/` folder rather than retrying the same endpoint repeatedly. For a written-only source article with no photo essay (no press photo gallery), search the outlet's own CDN directly (e.g. `smartcdn.gprod.postmedia.digital` for Financial Post) — a plain Google Images search often surfaces the article's own hero image URL directly in the page HTML. If only one confirmed real photo of the subject exists, reuse it across the 2–3 most "personal" beats (hook, name-reveal, closing bookend) and fill every other slide with topical Unsplash b-roll — document this explicitly in `CREDITS.md`, don't quietly pretend there's more real photography than there is.
5. **Build a contact sheet and mapping sheet** (quick PIL grid script into the scratchpad) before spending API credits — show the candidate photo grid, then a slide-by-slide mapping (photo + caption side by side) for the user to sanity-check. Get a green light on the mapping before running the paid batch, unless the user has already pre-approved the sourcing approach for that conversation (e.g. "grab what you can and fill with Unsplash" counts as pre-approval — don't re-ask after that).
6. **Run the batch**: `export OPENROUTER_API_KEY=...` (pull from the repo's `.env`), then `python3 process.py` (cartoonifies every non-CTA slide) and `python3 build_cta.py` (builds slide-13 separately, not AI-redrawn).
7. **Build a final 14-slide review sheet** and write `CREDITS.md` — every slide's source photo, origin (real press photo vs. Unsplash vs. reused prior-post b-roll), and license.

### Turning a post into a blog post + X posts

Added 2026-07-13, applies to every post in this sub-format going forward:

1. **Write `content/blog/<post-slug>.md`** in the actual repo (not the Desktop folder). Frontmatter: `title` (≤51 chars so it stays ≤60 once `· Crawli` is appended — see the site-wide rule in the top-level `CLAUDE.md`), `description`, `date`/`updated`, `cover`, `tags`, `faq` (3–4 Q&A pairs whose `answer` text should be traceable to something actually stated in the post body — `lib/blog.ts` mirrors these into `FAQPage` JSON-LD, so they need to hold up as real content, not just SEO filler).
2. **Cover image**: copy the pre-caption illustration from the Desktop pipeline's `output/raw/slide-00.png` (or `.jpg`) into `public/blog/images/<post-slug>-cover.png`. If a post has no separate raw/pre-caption file (older manual runs, e.g. the Wisdom Kaye pilot), crop the caption band off the composited image with PIL instead of using a caption-baked image as the cover.
3. **Body**: H2 sections only — the page template renders `post.title` as the H1 automatically, so a body `#` would create a duplicate H1. Expand the same beats used in the carousel into narrative prose, with real citations (outlet name + actual URL, found via WebSearch/WebFetch, never fabricated) for the facts that need one. Close with one soft, natural Crawli mention and a link to `/`.
4. **`compareSlug`**: only set this if a live `/compare/[slug]` item genuinely matches the story (check `compare_items` in Supabase — project ref `peyqxfijdrziqfjkxjsn` — via `execute_sql`, e.g. `select slug, name, category from compare_items where enabled = true`). These are creator/seller profile posts, not buying guides, so most of the time nothing will match — skip the field rather than forcing a mismatched item onto the post.
5. **Verify before calling it done**: sanity-check the frontmatter parses (`node -e "require('gray-matter')..."`), start the dev server, `curl` the new page and confirm a 200, the expected `<title>`, exactly one `<h1>`, and `FAQPage` in the response body, then free ports 3000 and 8000 per the repo's testing checklist.
6. **Draft 3 X post options** referencing the new blog URL (`thecrawli.com/blog/<post-slug>`), each pulling a different hook angle (a specific-number stat, a celebrity/social-proof detail, or the narrative arc). No em dashes or en dashes anywhere — hyphens/commas/periods only, per the project's marketing punctuation rule. Leave the URL as a `[link]` placeholder; whether to add UTM params is the user's call, not a default.

Nothing in this whole pipeline auto-commits — leave the blog `.md` files, cover images, and Desktop carousel folders for the user to review and commit themselves.

## Original photo-only pilot (2026-07-07, superseded for new posts)

9 slides: hook (unresolved tension, no name yet) → 5 beats (one real photo + one short line each, 5-12 words) → lesson (the arc resolves into one takeaway) → tie-in (soft Crawli aside, decoupled from the subject's story, plus a source citation) → cta (explicit Crawli call-to-action, closing the post). Built via `../export-slides.js` (Puppeteer, HTML source) rather than the Python/OpenRouter pipeline above.

**CTA policy:** unlike the fact-carousel batches (`../POSTS_README.md`), which follow an obfuscate-commercial-intent rule, the journey series closes every post with a dedicated, explicit CTA slide: Crawli badge, direct call-to-action line, and the URL. Deliberate exception, not an oversight — a journey post already reads as editorial commentary on a real, cited story, so it can afford to ask directly at the end, the same way a magazine feature can close with a subscribe link.

**Photo policy (this format only — see the illustrated pipeline above for the current default):** real photography only, no AI generation, no unlicensed third-party press photos. Priority order: (1) free commercial-use licensed stock (Unsplash/Pexels License) of the literal object/scene, (2) the subject's own public social content where directly commenting on that specific post, (3) AI-generated b-roll as a last resort, never a fabricated face of the real person. Every post's `images/CREDITS.md` records the source URL and license for each photo.

**Protagonist policy:** real names and real, publicly reported story facts, used under editorial commentary. The final slide always carries a source citation. The Crawli tie-in never implies the subject uses or endorses Crawli. (This still holds for the illustrated pipeline too.)

**Visual system:** Fraunces (headings/captions) + Work Sans (small UI text). Full-bleed real photo + bottom scrim + chapter counter + one caption line. Fixed across the series; only the accent color varies per story.

**Caption format:** same TikTok title/description rules as the fact-carousel series (`../POSTS_README.md`), plus a source-citation line naming the real person and outlets. May end with a direct Crawli CTA line.

## Batch index

| Date | Format | Folder | Subject |
|---|---|---|---|
| 2026-07-07 | Photo-only pilot | `2026-07-07-pilot/` (this repo) | Emma Rogue — The Depop Blowup |
| pre-2026-07-13 | Illustrated | `~/Desktop/nano-banana-tests/post1.zip` | Wisdom Kaye — TikTok to Balmain |
| 2026-07-13 | Illustrated | `~/Desktop/nano-banana-tests/emmarogue/` | Emma Rogue — full journey (denser retelling) |
| 2026-07-13 | Illustrated | `~/Desktop/nano-banana-tests/satu-poshmark/` | Satu Tuohimaa — Poshmark side hustle |

Each illustrated post's matching blog post lives at `content/blog/<subject-slug>.md` in this repo — see "Turning a post into a blog post + X posts" above.
