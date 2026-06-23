# Crawli Social Media Posts

## Batch Index

Each batch has one HTML source file and one exports folder. They are linked by date below. When a new batch is created, add a row here.

| Date | HTML Source | Captions File | Exports Folder | Posts |
|------|-------------|---------------|----------------|-------|
| 2026-06-15 | `2026-06-15/content-posts-slides.html` | `2026-06-15/post-captions.md` | `2026-06-15/exports/carousel/` | 10 step-by-step carousel posts |
| 2026-06-16 | `2026-06-16/content-posts-slides.html` | `2026-06-16/post-captions.md` | `2026-06-16/exports/carousel/` | 12 carousel posts (all carousel; brief "reel" items built as carousels) |
| 2026-06-18 | `2026-06-18/content-posts-slides.html` | `2026-06-18/post-captions.md` | `2026-06-18/exports/carousel/` | 16 carousel posts (posts 1-3 from the original small batch; posts 4-16 added later the same day after wiring Reddit pain-point research into the brief generator — see Post Breakdown — Day 4) |
| 2026-06-22 | `2026-06-22/content-posts-slides.html` | `2026-06-22/post-captions.md` | `2026-06-22/exports/carousel/` | 8 carousel posts (posts 1-2 approved by user mid-batch, feedback applied to posts 3-8 the same session) — see Post Breakdown — Day 5 |
| 2026-06-23 | `2026-06-23/content-posts-slides.html` | `2026-06-23/post-captions.md` | `2026-06-23/exports/carousel/` | 8 carousel posts, all creative decisions pre-specified — new split/grid layouts, new Anton+Epilogue and Cormorant+Montserrat font pairings, Brutalism/Glassmorphism style movements, side-rail text placement, 5 of 8 covers feature a human subject — see Post Breakdown — Day 6 |

**Folder structure:**
```
docs/marketing/
  POSTS_README.md
  post-captions.md
  export-slides.js          ← shared export script (stays at top level)
  YYYY-MM-DD/               ← one folder per batch, named by date
    content-posts-slides.html
    exports/
      carousel/
        post-01/slide-01.png ...
```

**Starting a new batch:**
0a. **Source fresh topics:** run the `/last30days` skill scoped to the niche (secondhand fashion, vintage, resale, thrifting, brands/eras) to pull what people are actually talking about now. Use those as the positive starting subjects. Cross-check each candidate `topic_key` against Supabase `content_history` — skip anything with `posted = true` (already posted). The twice-weekly n8n brief is idea-fodder; `/last30days` is the live freshness source at build time.
0b. **Plan visuals:** run `node check-visual-diversity.js` (in `docs/marketing/`) and apply its output — see the `marketing-visual-diversity` skill. Read the `=== PREVIOUS BATCH ... DO NOT REUSE ===` block; the new batch must differ on `font_pairing` AND `text_placement` AND `layout`. Pull a genuinely different font pairing / layout / style movement from the `ui-ux-pro-max` skill. Do not default to the last batch's look from memory.
1. Create folder `docs/marketing/YYYY-MM-DD/`
2. Create `content-posts-slides.html` inside it (slide designs)
3. Create `post-captions.md` inside it (TikTok copy for every post — see caption format rules below)
4. Update `SLIDE_COUNTS` in `export-slides.js` to match the new post count
5. Run: `node export-slides.js --batch=YYYY-MM-DD`
6. Add a row to this Batch Index
7. Append each post's `color_hex`/`color_name`/`typography`/`font_pairing`/`layout`/`text_placement`/`imagery`/`style_movement` to `visual-history.json` (required, all fields — this is what step 0 checks for the next batch; omitting `font_pairing`/`text_placement`/`layout` triggers a `!!! BLOCK` and blinds the diversity check)
8. Mark the posted ideas `posted = true` in Supabase `content_history` so the content brief never re-suggests them — see "After posting a social batch" in `docs/SERVER_REFERENCE.md`. Use each post's `#topic-key` from the brief email.

---

## Design System (apply to all future posts)

### Slide Format
- **Platform:** TikTok photo carousels only (Instagram dropped 2026-06-19 — no IG captions, no IG posting steps, no IG-specific fields anywhere in the pipeline).
- **Aspect ratio:** 4:5 (1080×1350px) is the default in `export-slides.js`, reverted back from 9:16 on 2026-06-22. The 2026-06-19 full 9:16 switch was undone because on a full-bleed 9:16 photo post, TikTok does not overlay the caption/title text on top of the image — once a caption runs past one line (plus the separate Title field), TikTok reserves that space by compressing/pushing the displayed image upward, since a 9:16 canvas has no built-in margin for it. 4:5 leaves empty canvas below the image for that text to render into, so the photo itself stays the size it was designed at instead of getting dynamically shrunk after upload. TikTok still overlays its own static chrome (profile icon, like/comment/share, sound disc) on the right edge of whatever vertical span the image occupies, so keep meaningful right-edge clearance in cover-photo content; bottom clearance can be lighter now since the caption no longer overlaps the image. See `export-slides.js` and `content-posts-slides.html` comments for the same rationale.
- **Slide count per post:** Cover + steps (4–6) + CTA = 6–8 slides total
- **Typeface:** NOT fixed — vary every batch. Pull a different `font_pairing` from the `ui-ux-pro-max` skill (`typography.csv`, 57+ pairings) and never reuse the previous 1–2 batches' pairing. `check-visual-diversity.js` prints the last batch's pairing to avoid. (System sans-serif was the old default and is the sameness trap — move off it.)

### Slide Types

| Type | Layout |
|------|--------|
| `cover-photo` | **Default cover now.** Full-bleed `gpt-image-2` photo → dark scrim → category badge → hook headline overlaid → "swipe" cue. The photo is generated with no baked-in text; the headline is HTML on top. |
| `cover` (SVG) | Legacy symbol cover (badge → headline → SVG visual). Allowed only as a deliberate non-photo variant, not the default. |
| `step` | Huge ghost step number (top-right) → icon box → "Step N" label → step title → one-line desc |
| `myth` | Ghost myth number → icon → myth text (struck-through, dim) → truth text (bright) |
| `cta` | crawli.co badge → action headline → Crawli tie-in line → hashtags |

### Visual System
- **Imagery mix (required):** the cover is ALWAYS a real `gpt-image-2` photo (`imagery: ai-raster`). Inner slides are a deliberate mix of the colorful symbol/clipart compositions AND photographic `gpt-image-2` images — not all-symbol like the old batches. `check-visual-diversity.js` flags `ai-raster`/`clipart` as under target until this shifts.
- **Step slides:** large ghost number + emoji icon carries the weight (symbol style), OR a photographic slide — alternate.
- **SVG style:** White strokes on color bg, opacity layers for depth, no text in SVGs
- **Colors:** One unique color per post. Gradient from base → darker shade (145deg). Light text on dark.

### Generating photo covers / slides (`gpt-image-2`)

Same OpenAI API key as everything else. From `docs/marketing/`:
```bash
python3 gen-clipart.py --style photo --quality medium \
  --prompt "a worn vintage leather jacket on a wooden hanger against a sunlit studio wall" \
  --out 2026-06-22/ai-images/post-01-cover.png
```
`--style photo` prepends an editorial-photo preamble, forces **no baked-in text** (headline is overlaid in HTML), defaults to portrait `1024x1536`, and keeps the upper-center calm for the overlay. `1024x1536` (~2:3) is `gpt-image-2`'s closest available portrait size to the 9:16 slide frame — it is not a bug; the `cover-photo` template's `object-fit: cover` crops it to fill 1080×1920 regardless. Save images into the batch folder so `export-slides.js` (which renders the HTML via Puppeteer over `file://`) picks them up with a relative path.

**Reusable `cover-photo` slide pattern** (full-bleed image + scrim + overlaid headline):
```html
<div class="slide cover-photo" style="--accent:#b45309">
  <img class="bg" src="ai-images/post-01-cover.png" alt="">
  <div class="scrim"></div>
  <div class="content">
    <span class="badge">VINTAGE</span>
    <h1 class="hook">how to spot real leather in 4 seconds</h1>
    <span class="swipe">swipe →</span>
  </div>
</div>
```
```css
.cover-photo { position:relative; overflow:hidden; }
.cover-photo .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
/* scrim keeps any overlaid headline legible regardless of the photo */
.cover-photo .scrim { position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(0,0,0,.10) 0%, rgba(0,0,0,.45) 65%, rgba(0,0,0,.75) 100%); }
/* padding right/bottom is the TikTok-UI safe zone: keep text out of roughly the
   right ~15-18% and bottom ~18-20% of the frame (where caption/like/share/profile/
   sound-disc UI sits). Px values below were validated at FULL 1080x1920 output
   scale directly (docs/marketing/_test, 2026-06-19, deleted after review) - NOT
   through the 440px-wide design-frame + zoom system export-slides.js actually
   uses for per-batch HTML. If authoring against the 440-wide design frame, scale
   these down by the zoom factor (~2.454) instead of copying the px values as-is,
   or just use the percentages above directly (right/bottom padding as % of frame
   width/height) which are scale-invariant either way. */
.cover-photo .content { position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:flex-end;
  padding: 80px 200px 280px 64px; color:#fff; } /* px tuned for direct 1080x1920 output */
.cover-photo .hook { font-size:92px; line-height:1.04; font-weight:800; margin:18px 0; }
```
Vary `text_placement` per batch — this `justify-content:flex-end` bottom-anchor is one option; top-anchored, centered, or side-rail are others (keep the same right/bottom safe-zone clearance regardless of which you pick). Don't ship the same placement two batches running.

### Color Palette (used so far — avoid repeating)

> This table is a human-readable historical mirror. `docs/marketing/visual-history.json` is now the source of truth for dedup — run `node check-visual-diversity.js` before picking a color for a new batch instead of scanning this table by hand. New entries should still be appended here for readability, but the script is what's actually checked against.
| Post | Color | Hex |
|------|-------|-----|
| Day 1: Tab Fatigue | Purple | #7c3aed |
| Day 1: Sneaker Crash | Red | #dc2626 |
| Day 1: Lowball Leverage | Blue | #2563eb |
| Day 1: Sizing Roulette | Teal | #0891b2 |
| Day 1: Super Fakes | Amber | #d97706 |
| Day 1: Watchlist Success | Green | #16a34a |
| Day 1: Utilitarian Trend | Slate | #475569 |
| Day 1: Shipping Fee Trap | Orange | #ea580c |
| Day 1: Circular Fashion | Emerald | #059669 |
| Day 1: Platform Stereotypes | Pink | #db2777 |
| Day 2: Pricing Strategy | Warm Amber | #b45309 |
| Day 2: Leather Boots | Cognac | #7c2d12 |
| Day 2: Luxury Myths | Violet | #5b21b6 |
| Day 2: Profile Optimization | Navy | #0c4a6e |
| Day 2: Sustainable Trends | Forest | #065f46 |
| Day 2: Vintage Sizing | Rose | #9d174d |
| Day 2: Timing Listings | Indigo | #3730a3 |
| Day 2: Spotting Fakes | Charcoal | #1c1917 |
| Day 2: Best Platforms | Deep Purple | #4c1d95 |
| Day 2: Platform Deep Dive | Teal Green | #065f46 |
| Day 3: Vintage Tees | Crimson Rose | #be123c |
| Day 3: Vintage Trends | Fuchsia | #a21caf |
| Day 3: Smart Sourcing | Royal Blue | #1e40af |
| Day 3: Item History | Sepia Bronze | #854d0e |
| Day 3: Shipping Myths | Deep Cyan | #155e75 |
| Day 3: Spotting Quality | Pine Green | #166534 |
| Day 3: Real Leather | Saddle Brown | #92400e |
| Day 3: Accessory Styling | Purple | #6b21a8 |
| Day 3: Personal Brand | Olive Lime | #4d7c0f |
| Day 3: Thrift Culture | Deep Teal | #134e4a |
| Day 3: Vintage vs Fast Fashion | Slate | #1e293b |
| Day 3: Inventory System | Indigo | #4f46e5 |
| Day 4: Hidden Marketplaces | Cyan | #0e7490 |
| Day 4: Buyer Habits | Burnt Orange | #c2410c |
| Day 4: Vintage Tee Hunting | Deep Teal | #0f766e |
| Day 4: Denim Evolution | Denim Blue | #1d4ed8 |
| Day 4: Slow Fashion | Moss Green | #3f6212 |
| Day 4: Pricing Secondhand | Mustard Gold | #ca8a04 |
| Day 4: 90s Legacy | Hot Magenta | #be185d |
| Day 4: Sustainable Trends | Eucalyptus | #15803d |
| Day 4: Leather Guide | Chestnut | #78350f |
| Day 4: Vintage Collectors | Plum | #86198f |
| Day 4: Fabric Guide | Indigo Ink | #312e81 |
| Day 4: Vintage Sizing (2nd) | Coral Rose | #e11d48 |
| Day 4: Resale Trends | Bronze | #a16207 |
| Day 4: Reseller Stories | Forest Teal | #0d9488 |
| Day 4: Shipping Practices (2nd) | Cobalt | #0369a1 |
| Day 4: Fashion Brand Myths | Wine | #7f1d1d |
| Day 5: Seller Scam Myths | Amber Alert | #f59e0b |
| Day 5: Selvedge Denim Facts | Indigo | #6366f1 |
| Day 5: Y2K Fashion Trends | Hot Pink | #ec4899 |
| Day 5: 1960s Fashion Guide | Monochrome | #18181b |
| Day 5: Handmade vs Machine Made | Violet | #8b5cf6 |
| Day 5: Wool Quality Facts | Navy | #0f172a |
| Day 5: Best Niches for Reselling | Tangerine | #f97316 |
| Day 5: The Search Problem | Teal | #14b8a6 |
| Day 6: Cross-Platform Price Gap | Sky Blue | #0ea5e9 |
| Day 6: The Story Sells It | Fuchsia | #d946ef |
| Day 6: The Birkin's Real Origin | Deep Navy | #1e3a8a |
| Day 6: Built for Pilots, Worn by Everyone | Near Black | #0f0f23 |
| Day 6: What's Inside Tells the Truth | Royal Purple | #7e22ce |
| Day 6: The Touch Test | Olive Green | #65a30d |
| Day 6: When the Price Doesn't Add Up | Rose Red | #f43f5e |
| Day 6: Big E, Red Tab, 1971 | Indigo Ink | #1e1b4b |

---

## Post Breakdown — Day 6 (2026-06-23)

All 8 posts built from a fully pre-specified creative brief (topics, copy, colors, and visual-system assignments given up front by the user, sourced via `/last30days` + Reddit pain-point patterns + Supabase `content_history` dedup + `ui-ux-pro-max` in a prior planning pass). Execution-only session: no topic/copy/color/layout invention, only building to spec and verifying output.

**New this batch (per `check-visual-diversity.js` + explicit user direction):**
- **Two new layouts:** `split` (image occupies roughly half the frame, text in the other half, alternating which side the image sits on per post) and `grid` (2x2 panel grid replacing the old single-column step list for fact/checklist-style posts — used on posts 3, 5, 7). Both layouts are new builds, not reused from any prior batch's `myth`/`editorial`/`number-left`/`visual-hero` CSS.
- **Two new font pairings:** "standard" track = Anton (heading) + Epilogue (body); "editorial" track = Cormorant (heading) + Montserrat (body). Neither pairing appears in any prior batch.
- **Two new style movements:** Brutalism (raw, high-contrast, blocky borders, hard offset shadows, sharp corners, no rounding) on standard-track posts; Glassmorphism (frosted/blurred translucent badge chips and CTA panels) on editorial-track posts.
- **`side-rail` text placement on every cover:** text lives in a vertical column anchored to one side of the frame (left or right, picked per post by cover composition), never top-anchor, bottom-anchor, or centered-stacked — all banned this batch since they were the 2026-06-22 batch's placements.
- **5 of 8 covers feature a human subject** (hands, three-quarter angle, or a generic stylish period-styled figure — never a recognizable real individual), up from 1 of 8 in the 2026-06-22 batch, per explicit user request for more human presence in cover photography.

**Build note (slide-count bug caught and fixed before final export):** the three grid-layout posts (3, 5, 7) consolidate their 4 body facts into a single `grid-panel` slide instead of 4 separate step slides, which means their total slide count is 6, not 7 like the split-layout posts. The first `export-slides.js` run used a uniform `SLIDE_COUNTS = [7,7,7,7,7,7,7,7]`, which made the script call `gotoSlide(6)` on posts with only 6 slides in the DOM — no slide ever got the `.on` class, so Puppeteer screenshotted the slide-7 frame with zero visible content (solid near-black, ~22KB instead of the normal 900KB+ a rendered slide produces). Caught by spot-checking exported file sizes (`find ... -size -50k` flagged 3 identical-byte-count files), confirmed by inspecting one of the flagged PNGs directly, root-caused with a Puppeteer debug script that printed `.slide` count per post (6 for posts 3/5/7, 7 for the rest) versus the slide counter showing `7 / 6`. Fixed by setting `SLIDE_COUNTS = [7,7,6,7,6,7,6,7]` to match each post's actual DOM slide count, then re-exporting cleanly (53 slides total, all file sizes back in the normal range, no blank frames).

| # | Title | Category | Layout | Typography | Style Movement | Imagery | Slides | Human Cover | Cover Subject |
|---|-------|----------|--------|------------|-----------------|---------|--------|--------------|----------------|
| 1 | Cross-Platform Price Gap | Resellers | split | standard (Anton + Epilogue) | Brutalism | ai-raster cover + symbol | 7 | No | split-screen phone app listings |
| 2 | The Story Sells It | Vintage Community | split | editorial (Cormorant + Montserrat) | Glassmorphism | ai-raster cover + symbol/clipart mix | 7 | Yes | hands writing on a fabric tag, holding a flannel |
| 3 | The Birkin's Real Origin | Fashion History | grid | editorial (Cormorant + Montserrat) | Glassmorphism | ai-raster cover + symbol, 4-panel grid interstitial | 6 | Yes | generic 1980s-styled woman by an airplane window |
| 4 | Built for Pilots, Worn by Everyone | Vintage Community | split | standard (Anton + Epilogue) | Brutalism | ai-raster cover + symbol/clipart mix | 7 | Yes | person in MA-1 bomber, three-quarter angle, face turned away |
| 5 | What's Inside Tells the Truth | Fashionistas | grid | editorial (Cormorant + Montserrat) | Glassmorphism | ai-raster cover + symbol, 4-panel grid interstitial | 6 | No | macro interior shot of an open luxury bag |
| 6 | The Touch Test | Vintage Community | split | standard (Anton + Epilogue) | Brutalism | ai-raster cover + symbol/clipart mix | 7 | Yes | close-up hand touching a shell button |
| 7 | When the Price Doesn't Add Up | All | grid | standard (Anton + Epilogue) | Brutalism | ai-raster cover + symbol, 4-panel grid interstitial | 6 | No | split-screen phone price comparison |
| 8 | Big E, Red Tab, 1971 | Resellers | split | editorial (Cormorant + Montserrat) | Glassmorphism | ai-raster cover + symbol | 7 | Yes | hands flipping through a denim rack |

---

## Post Breakdown — Day 5 (2026-06-22, in progress)

Built from the 2026-06-22 content brief (15 ideas) plus this session's own audit: cross-checked all 15 against Supabase `content_history` `posted=true` directly (not just the brief's 3 self-flagged repeats) and found 4 more real duplicates the brief missed (vintage-collector-profiles repeats "Profiles of Vintage Collectors" 2026-06-18; 1990s-fashion-guide repeats "Legacy of 90s Fashion" 2026-06-18; shipping-solutions repeats "Shipping Best Practices" posted 3x already; sustainable-fashion-news overlaps 3 prior sustainable posts). Trends validated via `/last30days` + WebSearch: Y2K and vintage/raw denim are the dominant 2026 resale categories; secondhand scam fear is data backed (40% of Depop buyers hesitant, 35% have hit fraud per a 2026 Consumer Reports survey, "paying outside the app" is the universal red flag).

All 8 posts built and exported. First batch built fully under the 2026-06-19 photo-cover rule (every cover is a real `gpt-image-2` photo, not an SVG symbol) and the first to break the font_pairing duopoly that had been either "System sans-serif" or "Playfair Display + Inter + JetBrains Mono" on every post since the project started — three new pairings introduced this batch (Syne + Manrope, Abril Fatface + Merriweather, Libre Bodoni + Public Sans), sourced from `ui-ux-pro-max` and rotated across posts.

**Mid-batch user feedback (after posts 1-2 shipped):** post 1 (myth layout + a stat interstitial) read as visually alive; post 2 (editorial layout, same symbol/clipart card on every step slide in a row) was called out as lacking creativity even though it correctly followed the "one imagery style per post" rule. Saved as [[feedback-marketing-intra-post-diversity]]: vary visuals *within* a single post too, not just across posts in a batch — add at least one interstitial (stat/pull-quote/manifesto) per post, never repeat an icon within the same post, and let imagery carry meaning where content has a natural contrast (e.g. clipart for the human/craft side vs symbol for the mechanical/abstract side on post 5). Also flagged: keep decorative display fonts (Abril Fatface, Syne, Libre Bodoni) to short headline text only, always paired with a genuinely legible body font — checked at actual mobile export size, not just as a CSS choice. Posts 3-8 were built applying this directly.

| # | Title | Category | Layout | Typography | Imagery | Slides | Pain point | Extra |
|---|-------|----------|--------|------------|---------|--------|-----------|-------|
| 1 | Seller Scam Myths | Resellers | myth | bold-modern (Syne + Manrope) | ai-raster cover + symbol | 7 | seller trust/scam fear (Reddit #1 pain point, 18 threads) | stat slide (35%), Minimalism & Swiss Style accent (first use) |
| 2 | Selvedge Denim Facts | Vintage Community | editorial | vintage-statement (Abril Fatface + Merriweather) | ai-raster cover + clipart | 7 | | |
| 3 | Y2K Fashion Trends | All | number-left | magazine (Libre Bodoni + Public Sans, first use) | ai-raster cover + symbol | 7 | | manifesto interstitial |
| 4 | 1960s Fashion Guide | Vintage Community | visual-hero | bold-modern | ai-raster cover + clipart/symbol mix | 7 | | pull-quote interstitial |
| 5 | Handmade vs Machine Made | Fashionistas | editorial | magazine | ai-raster cover + clipart/symbol contrast (handmade=clipart, machine=symbol, deliberate) | 7 | | stat slide (0) |
| 6 | Wool Quality Facts | Fashionistas | number-left | vintage-statement | ai-raster cover + symbol/clipart mix | 7 | | stat slide (19.5 microns) |
| 7 | Best Niches for Reselling | Resellers | visual-hero | bold-modern | ai-raster cover + clipart/symbol mix | 7 | | manifesto interstitial; reframed as product categories, not platforms, to differentiate from posted "best-niche-marketplaces" |
| 8 | The Search Problem | All | myth | magazine | ai-raster cover, no inner visuals (myth layout) | 6 | search/discovery is bad (Reddit pain point); not from today's brief, added from this session's own pain-point synthesis since it maps directly to Crawli's core pitch | stat slide (5+) |

japanese-denim-history was considered and parked for a future batch to avoid two denim posts in one batch (post 2 already covers denim).

---

## Post Breakdown — Day 4 (2026-06-18)

**Part 1 (posts 1-3):** source brief had 15 ideas; **12 were dropped as near-duplicates of posts already shipped in Day 2/Day 3** (full audit below). Only 3 angles were genuinely new, so this first batch was intentionally small rather than padded with repeats.

**Why future batches should be bigger and more varied:** the duplicate flood was root-caused (see HANDOFF "content-brief workflow v2") to a too-narrow taxonomy + weak dedup in the n8n generator. The fix broadens the brief into **educational/informational pillars** — fashion history, makers & craft, materials & construction, culture/scene (e.g. Japanese denim, prep, workwear), era guides, and reseller/collector stories — so future briefs will include teach-the-reader posts, not just tips/how-tos. **Embrace these when building carousels:** an "origin of the trench coat" or "how to read a fabric tag" carousel is on-brand and uses the same slide system. The generator also now flags likely repeats in the email itself, so trust those flags but still eyeball against this README's history tables.

**Part 2 (posts 4-16), added later the same day:** Reddit pain-point research (`reddit_research` table, 89 threads analyzed) was wired into the brief generator's prompt, and the dedup check was re-run against history that reflects what was actually published, not every idea ever generated including unused test-run output. Of the second 15-idea brief, 11 were genuinely clean, 2 more were only blocked by ideas nobody had ever posted (included), and 2 were true repeats (dropped, see below).

**Part 2 rebuilt (same day, second pass):** the first version of part 2 shipped with two real problems, caught on review: (1) **every post used identical symbol-icon imagery and standard typography across only 3 layouts**, ignoring the Creative Diversity & Visual Experimentation system below entirely, and (2) **a real bug** — `renderNumberLeft` reads `s.num` for the giant ghost number, but the step objects only carried `label`, so every number-left post rendered the literal word "undefined" in huge text across every step slide (visible on posts 4, 7, 10, 13, 16). Both fixed: the `myth` layout (struck-through myth / bright reality reveal) and the colored figurative clipart system were actually built into this batch's HTML (previously only existed as reference code in this README, never wired into a live batch file), along with `manifesto`, `pull-quote`, and `stat` interstitial slide types and the editorial typography track (Playfair Display / JetBrains Mono / Inter). Verified programmatically across all 116 rendered slides with zero "undefined"/"NaN" occurrences, not just spot-checked.

**Part 2 final mix:** 4 layouts used (number-left, visual-hero, editorial, **myth** — first use), imagery roughly 54% symbol / 46% colored clipart (AI raster skipped to avoid spend without asking first), typography ~38% editorial / 62% standard (target was ~40/60), and 7 of 13 posts carry one manifesto/pull-quote/stat interstitial as a rhythm break, per the "seasoning, not the meal" guidance below.

| # | Title | Category | Layout | Typography | Imagery | Slides | Pain point | Extra |
|---|-------|----------|--------|------------|---------|--------|-----------|-------|
| 1 | Hidden Marketplaces | Resellers | number-left | standard | symbol | 8 | | |
| 2 | Buyer Habits | Fashionistas | visual-hero | standard | symbol | 8 | | |
| 3 | Vintage Tee Hunting | Vintage | editorial | standard | symbol | 8 | | |
| 4 | Denim Evolution | All | number-left | standard | symbol | 8 | | stat |
| 5 | Slow Fashion Movement | Vintage Community | visual-hero | editorial | clipart | 7 | | manifesto |
| 6 | How to Price Secondhand Clothes | Resellers | editorial | standard | symbol | 8 | underpricing | pull-quote |
| 7 | Legacy of 90s Fashion | Vintage Community | number-left | standard | clipart | 7 | | |
| 8 | Sustainable Fashion Trends | All | visual-hero | editorial | symbol | 6 | | manifesto |
| 9 | Understanding Leather Types | Fashionistas | editorial | editorial | clipart | 7 | | |
| 10 | Profiles of Vintage Collectors | Vintage Community | number-left | editorial | clipart | 7 | | pull-quote |
| 11 | Knowing Your Fabrics | All | visual-hero | standard | clipart | 6 | | |
| 12 | Understanding Vintage Sizes | Vintage Community | editorial | standard | symbol | 7 | sizing inconsistency | |
| 13 | Resale Market Trends | Fashionistas | number-left | standard | symbol | 8 | | stat |
| 14 | Tips from Successful Resellers | All | visual-hero | editorial | clipart | 7 | | pull-quote |
| 15 | Shipping Best Practices | Resellers | editorial | standard | symbol | 7 | shipping speed | |
| 16 | Debunking Fashion Myths | Fashionistas | **myth** | standard | symbol | 7 | | |

**Dropped from part 2 (true duplicates):** "Niche Marketplaces for Secondhand Finds" (duplicates published "Hidden Marketplaces"), "Hunting for Vintage Band Tees" (duplicates an older published idea). A corresponding blog brief, "The hidden gems of niche secondhand marketplaces," was also dropped as a genuine duplicate of the already-published `best-niche-marketplaces-for-vintage-finds.md`.

**Dropped ideas and their duplicate (from the original 15-idea brief, part 1):**

| Dropped idea | Duplicates |
|---|---|
| Pricing / emotional attachment | Day 2 Post 1 "Pricing Strategy" |
| Luxury myths (not overpriced) | Day 2 Post 3 "Luxury Myths" |
| Depop profile optimization | Day 2 Post 4 "Profile Optimization" |
| Sustainable trends + vintage | Day 2 Post 5 "Sustainable Trends" / Day 1 "Circular Fashion" |
| Luxury myths (quality/style) | Same brief, duplicate of the luxury-myths idea above; also Day 2 Post 3 |
| Counterfeit/authentication checks | Day 1 "Super Fakes" / Day 2 Post 8 "Spotting Fakes" |
| Vintage sizing by decade | Day 2 Post 6 "Vintage Sizing" / Day 1 "Sizing Roulette" |
| Shipping efficiency for resellers | Day 3 Post 5 "Shipping Myths" |
| 2026 vintage trends | Day 3 Post 2 "Vintage Trends Right Now" |
| Real leather identification | Day 3 Post 7 "Real vs Fake Leather" |
| Inventory management | Day 3 Post 12 "Inventory System" |
| Item history / provenance | Day 3 Post 4 "Every Item Has a Story" |

---

## Archive: Previous Batch Breakdowns (Days 1–3)

## Caption Format (apply to every post in post-captions.md)

Each post needs two sections: TikTok Title, TikTok Description. (Instagram dropped 2026-06-19 — TikTok-only now.)

**TikTok Title** (separate field in the app, above the carousel):
- **Max 90 characters** (hard limit — count them; the app truncates past this)
- Punchy and specific — states the benefit or the exact topic
- Not a question, not generic ("here are 6 tips") — make it the thing someone would search

**TikTok Description:**
- 150-400 words. Longer descriptions rank better in TikTok search — treat it like a short article.
- Repeat the key topic words naturally in the text (TikTok weights keywords in copy more than hashtags)
- Structure: context/hook → bullet breakdown of each slide's point → Crawli tie-in line with `thecrawli.com`
- **Max 5 hashtags** at the end (TikTok deprioritizes hashtag-stuffed captions — pick the 5 best, keyword-rich ones)

---

## Review Workflow

1. Open the relevant `.html` file in a browser
2. Use `← →` arrow keys or side buttons to move through slides
3. Use `↑ ↓` arrow keys or Post buttons to jump between posts (Day 2 file)
4. Use dropdown to jump directly to a post
5. Give feedback on: copy tone, visual direction, colors, missing angles
6. Hand off approved posts with the export script below

---

## Exporting Slides as Images

Run the export script (requires Node.js + Puppeteer):

```bash
cd docs/marketing
npm install puppeteer                          # one-time install
node export-slides.js                          # exports current batch (2026-06-15)
node export-slides.js --batch=2026-06-22       # exports a different batch
```

Output: `docs/marketing/YYYY-MM-DD/exports/carousel/post-01/slide-01.png`

Each PNG is saved at **2× DPR** (2160×2700px, 4:5). Script uses CSS `zoom` to scale the design frame for pixel-perfect proportions; `DESIGN_H` is derived from `width`/`height` so the frame shape always matches the configured aspect ratio.

**When adding a new batch:** update `SLIDE_COUNTS` in `export-slides.js` to match the new posts, then run with `--batch=YYYY-MM-DD`.

### Export script gotchas (fixed 2026-06-15)

| Problem | Fix |
|---------|-----|
| `gotoSlide is not defined` | `gotoSlide()` must be explicitly defined in the HTML — `changeSlide(d)` takes a delta, not an index |
| `headless: 'new'` crash | Puppeteer 22+ removed `'new'`; use `headless: true` |
| Blurry text | Non-integer `deviceScaleFactor` (e.g. 2.4545) causes sub-pixel hinting artifacts; use integer DPR=2 + CSS `zoom` instead |
| Bottom of slides cut off | Cover SVGs with no explicit `width`/`height` scale to intrinsic viewBox height, overflowing the 550px frame; fixed with `min-height: 0` on `.cover-visual` + `max-height: 100%` on the SVG |
| Frame positioned too low | Body padding + nav bars push frame below viewport; use `position: fixed; top: 0` on `#frame` and hide `.top-bar`, `.post-label`, `.bot-bar` via injected CSS |

---

## Posting to TikTok

**TikTok photo carousel:**
- TikTok supports photo posts (carousels) natively
- Export at the default 1080×1350 (4:5)
- Open TikTok app, tap "+" to create, select photos
- Add the slides in order, write caption + hashtags

**TikTok video (alternative):**
- TikTok's algorithm still favors video over photo carousels
- To convert: use `ffmpeg` to stitch images into a slideshow video
- `ffmpeg -framerate 0.5 -pattern_type glob -i 'post-01/*.png' -vf scale=1080:1920 output.mp4`

**Quality tips:**
- Always export at 2× scale (already default in the script)
- On TikTok: upload from a fast connection; re-compression is aggressive on mobile uploads

---

## Rules for Future Posts

- Each new batch = new HTML file (`content-posts-slides-day3.html`, etc.)
- Update this README with new posts and colors used
- Never reuse a color from the palette above without a strong reason
- **Hashtags belong in the caption, NOT on the visual slides** — keep slides clean
- **No dot/circle navigation** — use simple prev/next buttons + counter only
- **Crawli logo** appears centered on every CTA slide (inline SVG, from `public/crawli.svg`)
- **CTA layout** — Crawli logo centered, headline centered, description left-aligned, URL centered
- **URL on CTA** is always `thecrawli.com`
- Cover SVGs: white/transparent on post-color background, one concept, no text in SVGs
- Step SVGs: white-background card (`vcrd` class) with post-accent colored symbol
- **SVG text rules**: always use `text-anchor="middle"` + `dominant-baseline="central"` for text inside shapes; set `y` to the geometric center of the containing rect/circle; never rely on default baseline alignment
- **NO DASHES OF ANY KIND in captions** — never use em dashes (—), en dashes (–), or hyphens in punctuation. Use commas, colons, or split into separate sentences instead. (Hyphens in compound words like "best-selling" are OK; the rule is about punctuation dashes.)
- No hashtags on slide visuals — they go in the post caption only

## Step Layout Variants (assign one per post, vary across batch)

| Layout | Description | Best for |
|--------|-------------|----------|
| `number-left` | Ghost large number top-left, visual card bottom-right, text left-aligned | Data/tips posts |
| `visual-hero` | Large centered SVG card, label + title + desc below/around | Visual/lifestyle posts |
| `editorial` | Small visual top-right, horizontal rule, large title below | Authoritative/luxury posts |
| `myth` | Special: struck-through myth + truth reveal, icon | Myth-busting only |

---

## Creative Diversity & Visual Experimentation (added 2026-06-17)

**Why:** Days 1–3 are all the same look — system-sans type, centered layout, abstract symbols, one color. Clean and recognizable, but monotonous. Introduce **deliberate visual variety** to A/B what performs, while keeping the system recognizable (one color per post, no slide hashtags, CTA with logo). Vary typography, imagery style, and layout *within* the Crawli system.

**Style movement (new, optional 5th axis, added 2026-06-18):** beyond layout/typography/imagery/color, a post can optionally lean into a named CSS style movement (minimalism, brutalism, glassmorphism, neumorphism, etc.) sourced from `ui-ux-pro-max`'s `styles.csv` via `check-visual-diversity.js`. This is the lever most likely to make a batch actually *look* different rather than just differently colored — use sparingly (it's a deliberate experiment, not a default) and track it in `visual-history.json`.

**Imagery decision (2026-06-17):** there are THREE imagery types. The diversity comes from **rotating ONE style per post across the batch** — NOT from mixing styles inside a single post.
1. **Original symbols** — white card + monochrome post-color symbol (Days 1–3 style). Free. Best for abstract/data posts.
2. **Colored vector clipart** — flat characters drawn directly as SVG. Free. Canonical code in the **Colored Clipart Build Kit** appendix below.
3. **AI raster** — `gpt-image-2` via `gen-clipart.py` (~$0.05/image medium, ~1¢ low). Richest look. See the **AI Raster Generation** section below.

**Rule: one imagery style per post.** A carousel is consumed as one unit; three illustration fidelities back-to-back read as inconsistent. Keeping each post to a single style (a) looks intentional, (b) lets us cleanly A/B which style drives saves/shares — the whole goal — since performance is attributable per post, and (c) controls AI cost (only AI-assigned posts spend anything).

**Sizing the split — use ratios, not counts.** Final batch sizes vary after dedup. Aim for roughly **35% symbol · 40% vector clipart · 25% AI raster** (e.g. 9 posts = 3 symbol · 4 vector · 2 AI). Tag each post's style in its Post Breakdown table. One imagery style per post only (never mixing all three in a single post). The full canonical clipart code is in the appendix below.

### 1. Typography — add an "editorial" track
The default track is system-sans, bold/800, centered. Add a second, opt-in track for posts that want a fashion/luxury/storytelling feel:

| Track | Heading | Body | Labels | Use for |
|-------|---------|------|--------|---------|
| **Standard** (default) | System sans, 800 | System sans | System sans, uppercase | Tips, data, how-to, myth-busting |
| **Editorial** (new) | `Playfair Display` 700–900, large, tight tracking (-1.5px), some words *italic* | `Inter` 300–500 | `JetBrains Mono` 500–600, uppercase, wide tracking (+.18em) | Vintage, fashion history, styling, brand-story, "manifesto" posts |

- Editorial fonts load via Google Fonts (`<link>` in `<head>`). Works in browser preview and in Puppeteer export when online.
- **Type-as-hero hooks:** on editorial covers, the headline IS the visual. Go big (40–46px), left-aligned, asymmetric, break it across 3 lines, italicize one accent word. Shrink or drop the cover illustration to a small bottom-right accent so type dominates.
- Don't mix tracks inside one post. Pick one per post; vary across the batch.

### 2. New slide types (mix these in as rhythm breaks)
Beyond `cover / step / myth / cta`, these are now approved:

| Type | What it is | When |
|------|-----------|------|
| `manifesto` | One oversized statement, no icon, optional gold/italic accent word + a small footnote line | Slide 2 of an editorial post, to set up the premise |
| `pull-quote` | Big italic serif quote, full-bleed, oversized `"` mark, mono attribution line | Mid-carousel pause between steps; great before the CTA |
| `stat` | One giant number/figure as the hero (e.g. a price, a percent, "6:1"), one line of context below | Data/proof posts |

Use **at most one or two** interstitials per post — they are seasoning, not the meal. Keep the numbered steps coherent.

### 3. Figurative scene illustrations
Replace abstract symbols with **a person doing the action** — flipping a rack, holding a shirt, shooting a flatlay. Two methods:

- **Colored vector clipart (default):** Flat characters in a cream card on the post's background. Built via SVG helpers (`tee()`, `head()`) that enforce consistent proportions (same collar height everywhere). See Colored Clipart Build Kit appendix.
- **AI raster (richest look):** Generated with `gpt-image-2` via `gen-clipart.py`. See AI Raster Generation section below.

**Symbols still work** for abstract/data posts. Use figurative clipart for posts with human actions. Mix all three types across a batch to A/B performance.

### 3b. AI Raster Generation (`gen-clipart.py`)
A no-dependency Python tool at `docs/marketing/gen-clipart.py` calls OpenAI's image API and saves a PNG. It reads `OPENAI_API_KEY` from the shell env or the repo `.env` automatically.

```bash
cd docs/marketing
python3 gen-clipart.py \
  --prompt "Flat color clipart illustration of a young person flipping through clothes on a thrift store rack, warm skin tone, dark hair, teal top, denim jeans, colorful hanging shirts in orange yellow and blue, plain solid cream background, centered, minimal, editorial, no text" \
  --out 2026-06-22/ai-images/rack.png \
  --model gpt-image-2 --quality medium --size 1024x1024
# add --transparent for a cut-out PNG instead of a cream background
```

- **Model: `gpt-image-2`** (chosen). Its low tier is as cheap as the mini (~$0.005) but it's the newest flagship and isn't deprecating (gpt-image-1 retires 2026-10-23). Options: `low | medium | high` quality; `1024x1024 | 1024x1536 | 1536x1024`.
- **Cost: ~$0.05 per medium 1024×1024 image.** Budget: cover at medium + body at `low` ≈ $0.10/post. Cap a batch at ~3 AI posts (≈ $0.30–1.00 total). Symbol and vector posts are free, so keep them the majority.
- **Prompt formula:** `Flat color clipart illustration of [a person doing X], simple flat vector shapes, warm skin tone, dark hair, teal top, denim jeans, [object/scene colors], plain solid cream background, centered, minimal, editorial, no text` — keep the style descriptors verbatim for consistency across generations.
- **Placement:** store PNGs in `<batch>/ai-images/`, render with `<img class="ccard aimg" src="ai-images/NAME.png">` where `.aimg{ object-fit:cover; }`. The image's own cream background becomes the framed card (no separate cream card needed).
- **Note:** OpenAI requires one-time org verification (gov ID) before image models work on a key; this account is already verified (test calls returned 200, not 403). If a future key 403s on image calls, that's the fix.

### 4. Layout variation
- **Asymmetric** beats centered for editorial posts: left-aligned type, label row with a big serif step number next to a mono "Step 01 / 04" tag, a horizontal rule, then the body.
- **Vary the cover composition per post** — type-dominant, scene-dominant, or split. Don't ship a batch where all 12 covers have the identical badge → title → centered-SVG stack.

### 5. Tone variation
- The editorial track pairs with **shorter, punchier sentences** and second person ("Walk in right after open and you are first hands on the new rack"). Less explainer, more voice.
- The standard track keeps the current informative tone. Don't make every post sound the same either — let the topic set the register.

### Rollout: 60% standard / 40% experimental per batch
Tag each post's track + imagery type in the Post Breakdown table. After 2–3 batches, check IG/TikTok saves/shares by type and lean into the winners.

---

## Colored Clipart Build Kit (canonical code)

Everything needed to rebuild the colored-clipart system. Copy these blocks into a new batch's `content-posts-slides.html`. All scenes use a **200×200 viewBox** inside a cream card on the post's monotone gradient.

### Proportion spec (locked)

| Part | Rule |
|------|------|
| Card | `viewBox 0 0 200 200`, `rx 18`, cream fill `#f7efe0`, floor strip at `y≈160` |
| Garment | Always `tee()`, never hand-drawn. Collar dip = `7×scale`, ensures collar sits at same height everywhere. |
| Head | Always `head(cx,cy)` with `r=13`, never a one-off. |
| Shoes | ellipse `rx 8, ry 4` |
| Person | Faces left; head at `y≈80–84`, stands at `x≈150–177` |

### Proportion / consistency checklist (run before exporting any clipart post)
- [ ] Every garment was produced by `tee()` (grep the scene for raw `<path` shirt shapes — there should be none)
- [ ] All collars sit at the same relative height on their garment (eyeball the rack: the 3 tees must match)
- [ ] Every head is `head(cx,cy)` with radius 13 — no stray `<circle ... r="12">` heads
- [ ] Skin tone, hair, teal top, denim are the **same hex** in every scene (use the `P` palette, no inline colors)
- [ ] Shoes, hand circles, and limb widths match across scenes
- [ ] The action is legible in 1 second (person + the one object they act on); add viewfinder/sparkle/ray cues if ambiguous
- [ ] Card, floor strip, and framing identical across all step slides

### CSS — card + new slide types
```css
:root{
  --c:#a16207; --bg:linear-gradient(150deg,#a16207 0%,#713f12 100%); /* swap per post */
  --ink:#fefce8; --ink-dim:rgba(254,252,232,.62); --line:rgba(254,252,232,.22); --gold:#fde68a;
  --serif:'Playfair Display',Georgia,serif; --sans:'Inter',-apple-system,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace;
}
/* Google Fonts <link> in <head>:
   Playfair+Display:ital,wght@0,500;0,700;0,800;0,900;1,500;1,600 | Inter:wght@300;400;500;600;700 | JetBrains+Mono:wght@500;600 */
.ccard{ border-radius:18px; box-shadow:0 12px 30px rgba(0,0,0,.28); display:block; } /* the SVG itself */
.step .scene-wrap .ccard{ width:262px; height:262px; max-width:90%; }
.cover .scene .ccard{ width:172px; height:172px; }
/* manifesto */ .manifesto .big{ font-family:var(--serif); font-weight:800; font-size:40px; line-height:1.08; letter-spacing:-1px; } .manifesto .big .hl{ color:var(--gold); font-style:italic; }
/* pull-quote */ .quote blockquote{ font-family:var(--serif); font-style:italic; font-weight:600; font-size:32px; line-height:1.22; letter-spacing:-.5px; } .quote .mark{ font-family:var(--serif); font-size:120px; line-height:.5; opacity:.18; }
/* editorial step */ .step .step-no{ font-family:var(--serif); font-weight:900; font-size:30px; } .step .step-of{ font-family:var(--mono); font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--ink-dim); } .step h2{ font-family:var(--serif); font-weight:700; font-size:28px; }
/* editorial cover hook */ .cover h1{ font-family:var(--serif); font-weight:800; font-size:41px; line-height:1.0; letter-spacing:-1.5px; } .cover h1 em{ font-style:italic; font-weight:600; }
```

### JS — palette + part builders (the source of consistency)
```js
const P = { cream:'#f7efe0', skin:'#e7ad84', hair:'#3a2a20', teal:'#2a9d8f', tealD:'#23867a',
  denim:'#46587a', denimD:'#3a496a', shoe:'#2b2b2b',
  g1:'#e76f51', g1D:'#c75a3f', g2:'#e9c46a', g2D:'#caa53b', g3:'#6d9eeb', g3D:'#5683c4',
  metal:'#9aa0a6', floor:'#ece1cd', door:'#e3d4ba', frame:'#b79b73' };

function head(cx,cy){ return `<circle cx="${cx}" cy="${cy}" r="13" fill="${P.skin}"/>
  <path d="M${cx-13} ${cy-1} q-2-17 14-17 q17 0 13 18 q-4-8 -13-8 q-9 0 -14 7z" fill="${P.hair}"/>`; }

function cardBg(floorY=160){ return `<rect width="200" height="200" rx="18" fill="${P.cream}"/><rect y="${floorY}" width="200" height="${200-floorY}" fill="${P.floor}"/>`; }

// THE garment template — symmetric about cx, collar locked to scale. Use for EVERY shirt.
function tee(cx, topY, color, collar, s=1, bodyH=46){
  const hw=19*s, nk=8*s, bh=12*s, shY=topY+4*s, slY=topY+12*s, ubY=topY+14*s, hemY=topY+bodyH, dip=topY+7*s;
  return `<path d="M${cx-nk} ${topY} L${cx-hw} ${shY} L${cx-hw+5*s} ${slY} L${cx-bh} ${ubY} L${cx-bh} ${hemY} L${cx+bh} ${hemY} L${cx+bh} ${ubY} L${cx+hw-5*s} ${slY} L${cx+hw} ${shY} L${cx+nk} ${topY} Q${cx} ${dip} ${cx-nk} ${topY} Z" fill="${color}"/>`
    + `<path d="M${cx-nk} ${topY} Q${cx} ${dip} ${cx+nk} ${topY}" fill="none" stroke="${collar}" stroke-width="${2.2*s}" stroke-linecap="round"/>`;
}
function hook(cx, topY){ return `<path d="M${cx} ${topY} L${cx} ${topY-9} q0 -3 3 -3" fill="none" stroke="${P.metal}" stroke-width="2"/>`; }

// standing person facing left; armTo=[hx,hy] is the far-hand target (what they reach for)
function personReach(armTo){ const [hx,hy]=armTo;
  return `<path d="M150 120 l-4 38 l9 0 l5-30 z" fill="${P.denimD}"/><path d="M161 120 l3 38 l9 0 l-2-38 z" fill="${P.denim}"/>
    <ellipse cx="151" cy="161" rx="8" ry="4" fill="${P.shoe}"/><ellipse cx="170" cy="161" rx="8" ry="4" fill="${P.shoe}"/>
    <path d="M147 92 q14-6 26 0 l3 30 q-16 6 -32 0 z" fill="${P.teal}"/>
    <path d="M171 98 l9 22 l-7 3 l-9-21 z" fill="${P.teal}"/><circle cx="177" cy="123" r="5.5" fill="${P.skin}"/>
    <path d="M150 100 Q${(150+hx)/2} ${Math.min(hy,100)-6} ${hx+6} ${hy} L${hx+4} ${hy+8} Q${(150+hx)/2} ${Math.min(hy,100)+4} 152 108 Z" fill="${P.teal}"/>
    <circle cx="${hx}" cy="${hy}" r="6" fill="${P.skin}"/>${head(160,80)}`;
}
```

### JS — the 5 starter scenes (each returns an `<svg class="ccard">` string)
```js
const SC = {
  rack: `<svg class="ccard" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    ${cardBg(160)}
    <rect x="32" y="50" width="124" height="5" rx="2.5" fill="${P.metal}"/><rect x="35" y="54" width="5" height="108" fill="${P.metal}"/><rect x="25" y="160" width="29" height="5" rx="2.5" fill="${P.metal}"/>
    ${hook(66,58)}${tee(66,58,P.g1,P.g1D,1,46)} ${hook(98,58)}${tee(98,58,P.g2,P.g2D,1,46)} ${hook(130,58)}${tee(130,58,P.g3,P.g3D,1,46)}
    ${personReach([118,104])}</svg>`,
  walkin: `<svg class="ccard" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    ${cardBg(162)}
    <rect x="128" y="34" width="52" height="128" fill="${P.door}"/><rect x="120" y="28" width="9" height="134" fill="${P.frame}"/><rect x="120" y="28" width="64" height="8" fill="${P.frame}"/>
    <path d="M86 120 l-13 36 l9 0 l12-30 z" fill="${P.denimD}"/><path d="M97 120 l12 33 l9 0 l-7-35 z" fill="${P.denim}"/>
    <ellipse cx="73" cy="158" rx="8" ry="4" fill="${P.shoe}"/><ellipse cx="113" cy="155" rx="8" ry="4" fill="${P.shoe}"/>
    <path d="M82 90 q14-6 26 0 l3 32 q-16 6 -32 0 z" fill="${P.teal}"/>
    <path d="M84 96 l-13 19 l7 4 l12-18 z" fill="${P.teal}"/><circle cx="73" cy="118" r="5.5" fill="${P.skin}"/>
    <path d="M106 98 l11 20 l-6 3 l-11-19 z" fill="${P.teal}"/><circle cx="113" cy="121" r="5.5" fill="${P.skin}"/>
    <path d="M101 123 l3 27 l23 0 l3-27 z" fill="${P.g3}"/><path d="M106 123 q8.5-15 17 0" fill="none" stroke="${P.g3D}" stroke-width="3"/>
    ${head(95,78)}</svg>`,
  inspect: `<svg class="ccard" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    ${cardBg(162)}
    <circle cx="44" cy="42" r="13" fill="${P.g2}"/><g stroke="${P.g2}" stroke-width="3" stroke-linecap="round"><line x1="44" y1="18" x2="44" y2="10"/><line x1="24" y1="30" x2="18" y2="25"/><line x1="64" y1="30" x2="70" y2="25"/><line x1="22" y1="54" x2="16" y2="59"/></g>
    ${tee(84,64,P.g1,P.g1D,1.35,64)}
    <path d="M150 122 l-4 36 l9 0 l5-29 z" fill="${P.denimD}"/><path d="M161 122 l3 36 l9 0 l-2-37 z" fill="${P.denim}"/>
    <ellipse cx="151" cy="161" rx="8" ry="4" fill="${P.shoe}"/><ellipse cx="170" cy="161" rx="8" ry="4" fill="${P.shoe}"/>
    <path d="M147 94 q14-6 26 0 l3 30 q-16 6 -32 0 z" fill="${P.teal}"/>
    <path d="M172 100 l8 20 l-7 3 l-8-20 z" fill="${P.teal}"/><circle cx="177" cy="123" r="5.5" fill="${P.skin}"/>
    <path d="M150 100 Q132 70 114 70 L112 80 Q134 82 152 108 Z" fill="${P.teal}"/><circle cx="113" cy="73" r="6" fill="${P.skin}"/>
    ${head(160,82)}</svg>`,
  feel: `<svg class="ccard" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    ${cardBg(162)}
    <rect x="34" y="42" width="84" height="5" rx="2.5" fill="${P.metal}"/>
    ${hook(76,48)}${tee(76,48,P.g3,P.g3D,1.2,62)}
    <g stroke="${P.g3D}" stroke-width="1.6" opacity=".6"><line x1="64" y1="74" x2="88" y2="74"/><line x1="63" y1="86" x2="89" y2="86"/><line x1="63" y1="98" x2="89" y2="98"/><line x1="64" y1="110" x2="88" y2="110"/></g>
    <path d="M150 122 l-4 36 l9 0 l5-29 z" fill="${P.denimD}"/><path d="M161 122 l3 36 l9 0 l-2-37 z" fill="${P.denim}"/>
    <ellipse cx="151" cy="161" rx="8" ry="4" fill="${P.shoe}"/><ellipse cx="170" cy="161" rx="8" ry="4" fill="${P.shoe}"/>
    <path d="M147 94 q14-6 26 0 l3 30 q-16 6 -32 0 z" fill="${P.teal}"/>
    <path d="M172 100 l8 20 l-7 3 l-8-20 z" fill="${P.teal}"/><circle cx="177" cy="123" r="5.5" fill="${P.skin}"/>
    <path d="M150 102 Q124 104 102 106 L103 114 Q126 112 152 110 Z" fill="${P.teal}"/><circle cx="98" cy="108" r="6" fill="${P.skin}"/>
    <path d="M93 104 l-6 -2 M93 112 l-6 3" stroke="${P.skin}" stroke-width="3" stroke-linecap="round"/>
    <path d="M90 92 l2 6 l6 2 l-6 2 l-2 6 l-2-6 l-6-2 l6-2z" fill="${P.g2}"/>
    ${head(160,82)}</svg>`,
  shoot: `<svg class="ccard" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    ${cardBg(158)}
    ${tee(44,150,P.g1,P.g1D,0.5,22)}<rect x="72" y="155" width="22" height="20" rx="3" fill="${P.g3}"/><ellipse cx="60" cy="183" rx="13" ry="6" fill="${P.g2}"/>
    <g stroke="${P.metal}" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M30 142 l0-6 l6 0"/><path d="M96 142 l0-6 l-6 0"/><path d="M30 184 l0 5 l6 0"/><path d="M96 184 l0 5 l-6 0"/></g>
    <path d="M120 116 L40 140 M120 116 L94 140" stroke="${P.g3}" stroke-width="1.5" opacity=".45" stroke-dasharray="3 3"/>
    <ellipse cx="150" cy="170" rx="9" ry="4" fill="${P.shoe}"/><ellipse cx="172" cy="170" rx="9" ry="4" fill="${P.shoe}"/>
    <rect x="146" y="146" width="9" height="22" rx="3" fill="${P.denimD}"/><rect x="168" y="146" width="9" height="22" rx="3" fill="${P.denim}"/>
    <path d="M150 150 l-26 -8 l4 -13 l30 8 z" fill="${P.denimD}"/><path d="M172 150 l-26 -10 l4 -13 l30 10 z" fill="${P.denim}"/>
    <path d="M150 96 q16 -3 26 5 l-4 28 q-16 3 -27 -5 z" fill="${P.teal}"/><path d="M152 104 l-30 8 l3 9 l30 -7 z" fill="${P.teal}"/>
    <rect x="112" y="108" width="16" height="11" rx="2.5" fill="${P.shoe}"/><rect x="114" y="118" width="12" height="3" rx="1.5" fill="${P.g3}"/><circle cx="124" cy="112" r="5.5" fill="${P.skin}"/>
    ${head(165,84)}</svg>`,
};
```

### Building a new clipart scene
1. Reuse `cardBg()`, `head()`, `tee()`, `hook()`, `personReach()` — do not inline a new shirt or head.
2. Pose the person by choosing the `armTo` target (where the hand reaches) and adding the one object they act on.
3. If the action is ambiguous, add a cue: sun + rays (light), sparkle (touch/quality), viewfinder + dashed cone (photographing).
4. Recolor per post by changing `--bg` / `--c`; the clipart palette `P` stays the same so characters read consistently across the whole feed.
5. Verify by screenshotting every slide (Puppeteer, DPR 2) and run the Proportion Checklist above before exporting.
