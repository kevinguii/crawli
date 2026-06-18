# Crawli Social Media Posts

## Batch Index

Each batch has one HTML source file and one exports folder. They are linked by date below. When a new batch is created, add a row here.

| Date | HTML Source | Captions File | Exports Folder | Posts |
|------|-------------|---------------|----------------|-------|
| 2026-06-15 | `2026-06-15/content-posts-slides.html` | `2026-06-15/post-captions.md` | `2026-06-15/exports/carousel/` | 10 step-by-step carousel posts |
| 2026-06-16 | `2026-06-16/content-posts-slides.html` | `2026-06-16/post-captions.md` | `2026-06-16/exports/carousel/` | 12 carousel posts (all carousel; brief "reel" items built as carousels) |

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
1. Create folder `docs/marketing/YYYY-MM-DD/`
2. Create `content-posts-slides.html` inside it (slide designs)
3. Create `post-captions.md` inside it (Instagram + TikTok copy for every post — see caption format rules below)
4. Update `SLIDE_COUNTS` in `export-slides.js` to match the new post count
5. Run: `node export-slides.js --batch=YYYY-MM-DD`
6. Add a row to this Batch Index

---

## Design System (apply to all future posts)

### Slide Format
- **Aspect ratio:** 4:5 (1080×1350px) — standard IG carousel. Story/Reel adapts to 9:16.
- **Slide count per post:** Cover + steps (4–6) + CTA = 6–8 slides total
- **Typeface:** System sans-serif, bold/800 weight for headlines

### Slide Types

| Type | Layout |
|------|--------|
| `cover` | Category badge → hook headline (large) → one-line sub → SVG visual → "swipe" cue |
| `step` | Huge ghost step number (top-right) → icon box → "Step N" label → step title → one-line desc |
| `myth` | Ghost myth number → icon → myth text (struck-through, dim) → truth text (bright) |
| `cta` | crawli.co badge → action headline → Crawli tie-in line → hashtags |

### Visual System
- **Cover SVG:** One clean thematic SVG per post (inline, white strokes, transparent fills, 120×120)
- **Step slides:** No illustration needed — large ghost number + emoji icon carries the visual weight
- **SVG style:** White strokes on color bg, opacity layers for depth, no text in SVGs
- **Colors:** One unique color per post. Gradient from base → darker shade (145deg). Light text on dark.

### Color Palette (used so far — avoid repeating)
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

---

## Post Breakdown — Day 3 (2026-06-16)

12 posts, all built as carousels. Source brief had 15 ideas; 3 were dropped as too close to Day 2 (emotional pricing vs Day 2 Pricing Strategy, luxury-secondhand myths vs Day 2 Luxury Myths, Depop listing optimization vs Day 2 Profile Optimization). Band-tee idea broadened to vintage tees generally; listing/quality framed multi-platform.

| # | Title | Category | Layout | Slides |
|---|-------|----------|--------|--------|
| 1 | Spotting Vintage Tees | Vintage | visual-hero | 7 |
| 2 | Vintage Trends Now | All | visual-hero | 6 |
| 3 | Smart Sourcing | Resellers | number-left | 8 |
| 4 | Every Item Has a Story | Fashionistas | editorial | 8 |
| 5 | Shipping Myths | Resellers | myth | 7 |
| 6 | Spotting Quality | All | number-left | 8 |
| 7 | Real vs Fake Leather | Vintage | visual-hero | 7 |
| 8 | Accessory Styling | Fashionistas | visual-hero | 8 |
| 9 | Personal Brand | All | editorial | 8 |
| 10 | Thrift Culture | Fashionistas | number-left | 8 |
| 11 | Vintage vs Fast Fashion | Vintage | myth | 6 |
| 12 | Inventory System | Resellers | number-left | 8 |

---

## Post Breakdown — Day 2

| # | Title | Category | Format | Slides |
|---|-------|----------|--------|--------|
| 1 | Pricing Strategy | Resellers | Carousel | 8 |
| 2 | Leather Boots Inspection | Vintage | Reel | 7 |
| 3 | Luxury Myths | Fashionistas | Carousel | 5 |
| 4 | Profile Optimization | Resellers | Carousel | 8 |
| 5 | Sustainable Trends | All | Reel | 6 |
| 6 | Vintage Sizing | Vintage | Carousel | 8 |
| 7 | Timing Listings | Resellers | Carousel | 7 |
| 8 | Spotting Fakes | Fashionistas | Reel | 8 |
| 9 | Best Platforms | All | Carousel | 8 |
| 10 | Platform Deep Dive | All | Reel | 7 |

---

## Post Breakdown — Day 1

| # | Title | Primary Angle |
|---|-------|---------------|
| 1 | Tab Fatigue | Too many apps, one search |
| 2 | Sneaker Crash | Volatility = need to compare |
| 3 | Lowball Leverage | Negotiation via comp data |
| 4 | Sizing Roulette | Vintage vs. modern sizing |
| 5 | Super Fakes | Authentication safety |
| 6 | Watchlist Success | Daily alert = grail found |
| 7 | Utilitarian Trend | Aesthetic search, not algorithm |
| 8 | Shipping Fee Trap | Total cost comparison |
| 9 | Circular Fashion | Sustainability + extended lifecycle |
| 10 | Platform Stereotypes | Humorous platform cultures |

---

## Caption Format (apply to every post in post-captions.md)

Each post needs three sections: Instagram, TikTok Title, TikTok Description.

**Instagram:**
- Hook sentence (shows in feed preview before "more" truncation)
- 2-3 sentences of body — what the carousel covers, why it matters
- Crawli tie-in line in parentheses with `thecrawli.com`
- 12-15 hashtags at the end (or paste into first comment)

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

Each PNG is saved at **2× DPR** (2160×2700px; Instagram/TikTok downscale cleanly). The script uses CSS `zoom` to scale the 440px design frame up to 1080px, keeping all font sizes and proportions pixel-perfect from the browser preview.

**When adding a new batch:** update `SLIDE_COUNTS` in `export-slides.js` to match the new posts, then run with `--batch=YYYY-MM-DD`.

### Export script gotchas (fixed 2026-06-15)

| Problem | Fix |
|---------|-----|
| `gotoSlide is not defined` | `gotoSlide()` must be explicitly defined in the HTML — `changeSlide(d)` takes a delta, not an index |
| `headless: 'new'` crash | Puppeteer 22+ removed `'new'`; use `headless: true` |
| Blurry text | Non-integer `deviceScaleFactor` (e.g. 2.4545) causes sub-pixel hinting artifacts; use integer DPR=2 + CSS `zoom` instead |
| Bottom of slides cut off | Cover SVGs with no explicit `width`/`height` scale to intrinsic viewBox height, overflowing the 550px frame; fixed with `min-height: 0` on `.cover-visual` + `max-height: 100%` on the SVG |
| Frame positioned too low | Body padding + nav bars push frame below viewport; use `position: fixed; top: 0` on `#frame` and hide `.top-bar`, `.post-label`, `.bot-bar` via injected CSS |

### Story/Reel format
`--size=story` (9:16) is **not supported** — the slide layout is 4:5 only. To post as a Story, crop the exported 1080×1350 in the app, or redesign the frame for 9:16.

---

## Posting to Instagram and TikTok

**Instagram carousel (recommended):**
- Export at `--size=carousel` (1080×1350)
- Open Instagram app or [Meta Creator Studio](https://business.facebook.com/creatorstudio) on desktop
- Create new post, tap the "+" and select all slide images for that post in order
- Write your caption with hashtags there (not on the slides)
- Schedule or post

**TikTok photo carousel:**
- TikTok now supports photo posts (carousels) natively
- Export at `--size=carousel` (1080×1350)
- Open TikTok app, tap "+" to create, select photos
- Add the slides in order, write caption + hashtags

**TikTok video (alternative):**
- TikTok's algorithm still favors video over photo carousels
- To convert: use `ffmpeg` to stitch images into a slideshow video
- `ffmpeg -framerate 0.5 -pattern_type glob -i 'post-01/*.png' -vf scale=1080:1920 output.mp4`

**Quality tips:**
- Always export at 2× scale (already default in the script)
- On Instagram: choose "High quality" when uploading, avoid JPEG compression
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
- No em dashes anywhere in copy — use commas, colons, or split into new sentences
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

**Why this section exists:** Days 1–3 all share one look — system-sans type, centered layout, abstract SVG symbols, one color per post. It is clean and recognizable, but every post reads the same. The goal now is **slight, deliberate diversity** — visually, tonally, and in imagery — so we can A/B what actually performs and lean into it. Keep the Crawli system recognizable (still one monotone color per post, still no hashtags on slides, still a CTA with the logo). Vary *within* it.

> Research backing (June 2026): carousels drive ~22% more saves than single images, and saves/DM-shares outweigh likes in the current algorithm. Posts with **custom illustrations** see up to ~40% higher engagement than stock/abstract visuals. The cover is the whole ballgame — it must answer "is this for me?" and "what do I get if I swipe?" in under 8–10 words. Build 3–5 recognizable layout templates and rotate them so the series stays cohesive while individual posts feel fresh. (Sources: socialhabitmarketing.com, truefuturemedia.com, lovart.ai, mindstudio.ai.)

**Imagery decision (2026-06-17):** there are THREE imagery types. The diversity comes from **rotating ONE style per post across the batch** — NOT from mixing styles inside a single post.
1. **Original symbols** — white card + monochrome post-color symbol (Days 1–3 style). Free. Best for abstract/data posts.
2. **Colored vector clipart** — flat characters drawn directly as SVG. Free. Canonical code in the **Colored Clipart Build Kit** appendix below.
3. **AI raster** — `gpt-image-2` via `gen-clipart.py` (~$0.05/image medium, ~1¢ low). Richest look. See the **AI Raster Generation** section below.

**Rule: one imagery style per post.** A carousel is consumed as one unit; three illustration fidelities back-to-back read as inconsistent. Keeping each post to a single style (a) looks intentional, (b) lets us cleanly A/B which style drives saves/shares — the whole goal — since performance is attributable per post, and (c) controls AI cost (only AI-assigned posts spend anything).

**Sizing the split — use ratios, not fixed counts.** The brief generator returns ~15 candidate ideas, then drops some that overlap prior days (e.g. Day 4 dropped 3 of 15 for being too close to Day 2 topics) — so the final batch size varies and is rarely exactly 12. Don't hardcode "4/5/3"; split the *actual* final batch roughly **35% symbol · 40% vector clipart · 25% AI raster**, rounding so the batch still totals 100%. (A 9-post batch ≈ 3 symbol · 4 vector · 2 AI; a 13-post batch ≈ 5 symbol · 5 vector · 3 AI.) Tag each post's style in its Post Breakdown table and let the data pick the winner after 2–3 batches. (Mixing all three in one post is fine ONLY for a side-by-side demo, never for a shipped post.) The full canonical clipart code lives in the appendix at the bottom of this file. (The `_experiments/2026-06-17-creative-test/` previews were folded into this README and deleted; everything needed to rebuild is here.)

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

### 3. Figurative scene illustrations (the big experiment)
Replace abstract symbols with **a person doing the action** — flipping a rack, holding a shirt to the light, shooting a flatlay. This is the "AI clipart of someone swinging a golf club" idea. Two ways to produce them:

- **Colored vector clipart (default, no external asset) — CHOSEN DIRECTION.** Flat colored characters (skin, hair, colored clothes) in a cream framed card (`.ccard`) on the post's monotone background. Drawn directly as SVG, crisp at any export size. Full code + the 5 starter scenes are in the **Colored Clipart Build Kit** appendix. **Critical consistency rule:** never hand-draw a one-off garment or head — always build them from the shared `tee()` and `head()` helpers so the **collar/neckline sits at the same proportion in every scene** (this was a real bug: separately-drawn shirts had collars in different spots). See the Proportion Checklist in the appendix.
- **AI raster images (richest look, WORKING as of 2026-06-17):** generated with `gpt-image-2` via `gen-clipart.py`, dropped into the *same `.ccard` frame* as an `<img>`. See the **AI Raster Generation** section just below for the tool, model, cost, and prompt formula. Tested end-to-end: AI raster + vector clipart + symbol all read coherently in one post.

**Symbols are NOT retired** — they still work for abstract/data posts. Figurative clipart (vector or AI) is for posts with a human action (thrifting, styling, inspecting, selling). Mix all three across a batch so we can compare.

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
- **Cost (measured): ~$0.05 per medium 1024×1024 image** (1756 output tokens × $30/M). `low` ≈ a cent; `high` ≈ $0.15–0.25. For clipart, **medium is plenty**. Use sparingly. Budget guide (with one-style-per-post): an all-AI post has ~6 image slides ≈ $0.30 at medium, or **cover at medium + body slides at `low` ≈ $0.10/post**. Cap a batch at ~3 AI posts and it stays ≈ $0.30–1.00. Symbol and vector posts are free, so they should be the majority.
- **Prompt formula that works:**
  > `Flat color clipart illustration of [a person doing X], simple flat vector shapes, warm skin tone, dark hair, teal top, denim jeans, [object/scene colors], plain solid cream background, centered, minimal, editorial, no text`
  Keep "teal top, denim jeans, warm skin tone, dark hair, cream background" verbatim — it keeps the AI character consistent with the vector clipart palette across generations (verified: two separate calls produced a matching character).
- **Placement:** store PNGs in `<batch>/ai-images/`, render with `<img class="ccard aimg" src="ai-images/NAME.png">` where `.aimg{ object-fit:cover; }`. The image's own cream background becomes the framed card (no separate cream card needed).
- **Note:** OpenAI requires one-time org verification (gov ID) before image models work on a key; this account is already verified (test calls returned 200, not 403). If a future key 403s on image calls, that's the fix.

### 4. Layout variation
- **Asymmetric** beats centered for editorial posts: left-aligned type, label row with a big serif step number next to a mono "Step 01 / 04" tag, a horizontal rule, then the body.
- **Vary the cover composition per post** — type-dominant, scene-dominant, or split. Don't ship a batch where all 12 covers have the identical badge → title → centered-SVG stack.

### 5. Tone variation
- The editorial track pairs with **shorter, punchier sentences** and second person ("Walk in right after open and you are first hands on the new rack"). Less explainer, more voice.
- The standard track keeps the current informative tone. Don't make every post sound the same either — let the topic set the register.

### How to roll this out (don't flip everything at once)
Per future batch, aim for roughly: **60% standard / 40% experimental**. Tag each post's track + imagery type in the batch's Post Breakdown table (add an "Imagery" column: `symbol` / `clipart` / `ai-raster`). After a few batches, check IG/TikTok saves + shares by type and let the data pick the winners.

---

## Colored Clipart Build Kit (canonical code)

Everything needed to rebuild the colored-clipart system. Copy these blocks into a new batch's `content-posts-slides.html`. All scenes use a **200×200 viewBox** inside a cream card on the post's monotone gradient.

### Proportion spec (locked — keep identical across every scene)

| Part | Rule |
|------|------|
| Card | `viewBox 0 0 200 200`, `rx 18`, fill `#f7efe0` cream, floor strip at `y≈158–162` |
| Garment (any shirt/tee/sweater) | **Always** built from `tee()` — never hand-drawn. Collar dip = `7×scale`, collar half-width = `8×scale`, shoulder half-width = `19×scale`, body half-width = `12×scale`. This is what keeps the collar in the same place everywhere. |
| Head | **Always** `head()` — radius **13**, hair path fixed. Never draw a one-off head. |
| Shoes | ellipse `rx 8, ry 4` (squat scene uses `rx 9`) |
| Limbs | torso ≈ 30 tall, legs ≈ 38, arm/hand skin circle `r 5.5–6` |
| Person | faces left, reaches with the far arm; stands at `x≈150–177`, head at `y≈80–84` |

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
