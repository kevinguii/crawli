# Crawli Social Media Posts

## Files

| File | Description |
|------|-------------|
| `social-posts-slides.html` | Day 1 — 10 buyer-focused posts (Tab Fatigue, Sneaker Crash, etc.). Single slide per post. |
| `content-posts-slides.html` | Day 2 — 10 informational/step-by-step posts (pricing, boots, myths, sizing, etc.). Full carousel format. |

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

## Review Workflow

1. Open the relevant `.html` file in a browser
2. Use `← →` arrow keys or side buttons to move through slides
3. Use `↑ ↓` arrow keys or Post buttons to jump between posts (Day 2 file)
4. Use dropdown to jump directly to a post
5. Give feedback on: copy tone, visual direction, colors, missing angles
6. Hand off approved posts with the export script below

---

## Exporting Slides as Images

Run the export script (requires Node.js):

```bash
cd docs/marketing
npm install puppeteer          # one-time install
node export-slides.js          # exports 1080×1350 (IG carousel)
node export-slides.js --size=story  # exports 1080×1920 (Story/TikTok)
```

Output: `docs/marketing/exports/carousel/post-01/slide-01.png` etc.

Each PNG is saved at **2× scale** (2160×2700 for carousel) for retina/high-resolution screens. Update `SLIDE_COUNTS` in the script when adding new batches.

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
