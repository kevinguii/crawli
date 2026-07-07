# Journey Carousel Pilot ("The Depop Blowup") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one 8-slide Pubity-style narrative carousel post — Emma Rogue's real, publicly documented Depop-to-storefront story — in a new `docs/marketing/journey-series/` folder, using real licensed photography (no AI, no unlicensed third-party press photos), export it, and hand it to the user for review.

**Architecture:** Reuses the existing carousel engine pattern from `docs/marketing/2026-07-02/content-posts-slides.html` (a `posts` data array + `buildSlideHTML` dispatcher + `changeSlide`/`changePost` nav, rendered into a `.frame` div) — same JS shape, new CSS slide type (`.journey-photo`, four variants: hook/beat/lesson/tie-in) and one new render function. Real photos are sourced from Unsplash/Pexels (free commercial-use licenses, no attribution required) rather than AI generation or the copyrighted Hypebae/Camila Palacios editorial photos.

**Tech Stack:** Static HTML/CSS/vanilla JS (no build step), Google Fonts CDN, existing Node/Puppeteer `export-slides.js` for PNG export.

## Global Constraints

- No URL, "search Crawli," "download," or "link in bio" anywhere on any slide or in the caption (obfuscate-CI rule, `docs/marketing/POSTS_README.md`).
- Crawli tie-in must never imply Emma Rogue uses or endorses Crawli — kept on its own slide, phrased as a general reseller aside.
- No AI-generated image anywhere in this post (per user instruction: real photos take priority over AI, this pilot goes real-only since licensed stock covers every beat).
- No unlicensed third-party press photo (e.g. no Hypebae/Camila Palacios image) — only Unsplash/Pexels (free commercial-use license) or truly generic real stock.
- Real name (Emma Rogue) and real story facts are used under editorial commentary and must be cited on the final slide + in the caption: "story reported by i-D, Hypebae, Elite Daily."
- Export at 4:5 (1080×1350), matching current `export-slides.js` config (`width=1080, height=1350`) — do not change aspect ratio.
- TikTok caption rules unchanged: title ≤90 chars, description 150-400 words, max 5 hashtags (`POSTS_README.md` "Caption Format" section).
- Font pairing and color must not duplicate anything in `docs/marketing/visual-history.json`.

---

### Task 1: Scaffold the journey-series folder and page shell

**Files:**
- Create: `docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html`
- Create: `docs/marketing/journey-series/2026-07-07-pilot/images/` (empty dir, populated in Task 2)

**Interfaces:**
- Produces: an HTML file with page shell (fonts, top-bar nav, `.frame`, bot-bar nav, base `<script>` block with `posts = []` placeholder array and the nav engine) that Task 3 fills in with real slide data.

- [ ] **Step 1: Create the folder structure**

```bash
mkdir -p docs/marketing/journey-series/2026-07-07-pilot/images
```

- [ ] **Step 2: Write the page shell**

Create `docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html` with this exact content (page shell only — slide-type CSS and post data are added in Tasks 2 and 4):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Crawli Journey Series — Pilot (2026-07-07)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Journey series pilot post 1: "The Depop Blowup" — Emma Rogue's real, publicly
     documented story (i-D, Hypebae, Elite Daily), used under editorial commentary,
     cited on the final slide. Real photos only (Unsplash/Pexels, free commercial
     license) — no AI generation, no unlicensed third-party press photos.
     Signature series look: Fraunces (headings/captions) + Work Sans (small UI text),
     warm taupe accent #6b5744 — fixed across every future journey post, exempt from
     the fact-carousel batches' per-batch font/layout rotation rule.
     See docs/superpowers/specs/2026-07-07-journey-carousel-format-design.md -->
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif;
  background: #0a0a0a;
  min-height: 100vh;
  display: flex; flex-direction: column; align-items: center;
  padding: 20px 16px 40px; gap: 14px;
}

.top-bar { width:100%; max-width:440px; display:flex; align-items:center; gap:10px; }
select { flex:1; padding:9px 12px; border-radius:8px; border:1px solid #2a2a2a; background:#1a1a1a; color:#ccc; font-size:13px; cursor:pointer; }
.nbtn { padding:9px 14px; border:1px solid #2a2a2a; border-radius:8px; background:#1a1a1a; color:#aaa; font-size:13px; cursor:pointer; white-space:nowrap; transition:all .15s; }
.nbtn:hover:not(:disabled) { background:#252525; color:#fff; }
.nbtn:disabled { opacity:.3; cursor:default; }
.post-label { width:100%; max-width:440px; font-size:11px; color:#444; text-transform:uppercase; letter-spacing:.1em; }

.frame { width:100%; max-width:440px; aspect-ratio:4/5; border-radius:18px; overflow:hidden; position:relative; box-shadow:0 24px 80px rgba(0,0,0,.7); }
.slide { display:none; width:100%; height:100%; position:absolute; top:0; left:0; }
.slide.on { display:block; }
.bot-bar { width:100%; max-width:440px; display:flex; align-items:center; justify-content:space-between; }
.slide-ctr { font-size:12px; color:#444; }

/* ── JOURNEY-PHOTO SLIDE TYPE CSS GOES HERE (Task 2) ── */

</style>
</head>
<body>

<div class="top-bar">
  <button class="nbtn" id="pp" onclick="changePost(-1)">← Post</button>
  <select id="sel" onchange="jumpPost(+this.value)">
    <option value="0">1 · The Depop Blowup 👟</option>
  </select>
  <button class="nbtn" id="np" onclick="changePost(1)">Post →</button>
</div>

<div class="post-label" id="plabel"></div>
<div class="frame" id="frame"></div>

<div class="bot-bar">
  <button class="nbtn" id="ps" onclick="changeSlide(-1)">←</button>
  <span class="slide-ctr" id="sctr"></span>
  <button class="nbtn" id="ns" onclick="changeSlide(1)">→</button>
</div>

<script>
// ─── RENDER FUNCTIONS GO HERE (Task 4) ──

// ─── POST DATA GOES HERE (Task 4) ──
const posts = [];

// ─── NAV ENGINE (unchanged from existing batches) ──
let pIdx = 0, sIdx = 0;
function renderPost() {
  const post = posts[pIdx];
  const frame = document.getElementById('frame');
  frame.innerHTML = post.slides.map(s => `<div class="slide ${post.fontClass || ''}">${buildSlideHTML(s, post)}</div>`).join('');
  document.getElementById('plabel').textContent = post.label;
  document.getElementById('sel').value = pIdx;
  sIdx = 0;
  updateSlide();
}
function updateSlide() {
  const post = posts[pIdx];
  document.querySelectorAll('.slide').forEach((el, i) => el.classList.toggle('on', i === sIdx));
  document.getElementById('sctr').textContent = `${sIdx + 1} / ${post.slides.length}`;
  document.getElementById('ps').disabled = sIdx === 0;
  document.getElementById('ns').disabled = sIdx === post.slides.length - 1;
  document.getElementById('pp').disabled = pIdx === 0;
  document.getElementById('np').disabled = pIdx === posts.length - 1;
}
function changeSlide(d) { sIdx = Math.max(0, Math.min(posts[pIdx].slides.length - 1, sIdx + d)); updateSlide(); }
function gotoSlide(i) { sIdx = i; updateSlide(); }
function changePost(d) { pIdx = Math.max(0, Math.min(posts.length - 1, pIdx + d)); renderPost(); }
function jumpPost(i) { pIdx = i; renderPost(); }

renderPost();
</script>
</body>
</html>
```

- [ ] **Step 3: Verify the shell opens without errors**

Run: `open docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html`
Expected: browser opens, shows an empty black frame with working nav buttons (no slides yet — that's correct at this step since `posts = []`). Check the browser console (View → Developer → JavaScript Console) for zero errors.

- [ ] **Step 4: Commit**

```bash
git add docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html
git commit -m "scaffold journey-series pilot page shell"
```

---

### Task 2: Build the journey-photo CSS (hook / beat / lesson / tie-in variants)

**Files:**
- Modify: `docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html` (replace the `/* ── JOURNEY-PHOTO SLIDE TYPE CSS GOES HERE (Task 2) ── */` comment)

**Interfaces:**
- Produces: CSS classes `.journey-photo`, `.journey-photo.variant-hook`, `.journey-photo.variant-beat`, `.journey-photo.variant-lesson`, `.journey-photo.variant-tie-in`, plus `.j-chapter`, `.j-badge`, `.j-caption`, `.j-swipe`, `.j-citation` — consumed by `renderJourneyPhoto()` in Task 4.
- Consumes: nothing (pure CSS addition to the existing shell from Task 1).

- [ ] **Step 1: Replace the CSS placeholder comment with the journey-photo slide system**

In `content-posts-slides.html`, replace this line:
```css
/* ── JOURNEY-PHOTO SLIDE TYPE CSS GOES HERE (Task 2) ── */
```
with:
```css
/* ════════════════════════════════════════════════════════════════════
   JOURNEY-PHOTO — signature series template, fixed across every journey
   post (font pairing + layout do NOT rotate per-batch like the fact-
   carousel series does). Full-bleed real photo + bottom scrim + a small
   chapter counter (top-left) + one short caption line (bottom).
   ════════════════════════════════════════════════════════════════════ */
.journey-photo { width:100%; height:100%; position:relative; overflow:hidden; background:#111; }
.journey-photo .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.journey-photo .scrim { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.20) 45%, rgba(0,0,0,.82) 100%); }
.journey-photo .content { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; padding:7% 9% 9%; color:#fdfaf6; }

.journey-photo .j-chapter { position:absolute; top:5%; left:7%; z-index:1; font-family:'Work Sans',sans-serif; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:#fdfaf6; opacity:.82; text-shadow:0 1px 8px rgba(0,0,0,.6); }
.journey-photo .j-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 13px; border-radius:100px; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.30); font-family:'Work Sans',sans-serif; font-size:10.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; width:fit-content; margin-bottom:14px; }
.journey-photo .j-caption { font-family:'Fraunces',Georgia,serif; font-weight:600; font-size:26px; line-height:1.22; text-shadow:0 2px 20px rgba(0,0,0,.55); }
.journey-photo .j-swipe { font-family:'Work Sans',sans-serif; font-size:11px; opacity:.78; letter-spacing:.06em; text-transform:uppercase; margin-top:12px; }
.journey-photo .j-citation { font-family:'Work Sans',sans-serif; font-size:10px; opacity:.62; letter-spacing:.02em; margin-top:14px; line-height:1.5; }

/* hook: bigger caption, badge shown, no chapter counter */
.journey-photo.variant-hook .j-caption { font-size:32px; }

/* beat: chapter counter shown, no badge, mid-size caption */
.journey-photo.variant-beat .j-caption { font-size:24px; }

/* lesson: no chapter counter (story has resolved), largest caption, italic emphasis */
.journey-photo.variant-lesson .j-caption { font-size:29px; font-style:italic; }

/* tie-in: smaller caption, citation line visible */
.journey-photo.variant-tie-in .j-caption { font-size:20px; }
```

- [ ] **Step 2: Verify the CSS parses cleanly**

Run: `open docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html`
Expected: still an empty frame (no slide data yet), zero console errors. This step only confirms no CSS syntax errors broke page load.

- [ ] **Step 3: Commit**

```bash
git add docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html
git commit -m "add journey-photo signature slide CSS (Fraunces + Work Sans)"
```

---

### Task 3: Source real licensed photos for all 8 slides

**Files:**
- Create: `docs/marketing/journey-series/2026-07-07-pilot/images/slide-01-hook.jpg` through `slide-08-tiein.jpg` (8 files)
- Create: `docs/marketing/journey-series/2026-07-07-pilot/images/CREDITS.md` (license/source record for each image)

**Interfaces:**
- Produces: 8 real photo files at `images/slide-0N-<name>.jpg`, each portrait or croppable to 4:5, each under a free commercial-use license (Unsplash License or Pexels License — both permit commercial use with no attribution required, but source URL is still logged for the record).
- Consumes: nothing.

Per-beat photo plan — all 7 unique images already identified and confirmed as free-to-use under the standard Unsplash License (not the paid Unsplash+ tier) via direct page lookup. All 8 slides use **real licensed stock photography** — Emma's own TikTok/Depop video content is not scraped in this pilot (extracting frames from a third party's video is out of scope for this session; if the user later obtains the actual footage, it can replace these in a follow-up post). None depict a recognizable person who could be mistaken for Emma Rogue — the phone/box/rack shots are all object/hand photography, not portraits.

| File | Beat | Photo (photographer) | Direct CDN URL |
|---|---|---|---|
| `slide-01-hook.jpg` | Hook — the shoes | Black-and-white platform sneakers (Krists Luhaers) | `https://images.unsplash.com/photo-1567159932018-025fbae84a91` |
| `slide-02-thrift.jpg` | Thrifted with mom | Rack of clothes and shoes in a store (Hugo Clément) | `https://images.unsplash.com/photo-1637228393246-c38a4b3d2011` |
| `slide-03-listing.jpg` | Listed on Depop | Assorted clothes hanged on clothes hanger (Megan Lee) | `https://images.unsplash.com/photo-1624192647570-1131acc12ccf` |
| `slide-04-biddingwar.jpg` | Bidding war | Person holding a cell phone in their hand (Solen Feyissa) | `https://images.unsplash.com/photo-1712002641088-9d76f9080889` |
| `slide-05-tiktok.jpg` | Packing-orders TikTok | Cardboard box sealed with red fragile tape (Ari Sha) | `https://images.unsplash.com/photo-1758351507026-71ad3645cb43` |
| `slide-06-viral.jpg` | 6M views, 40k followers | Person using smartphone to view social media analytics | `https://images.unsplash.com/photo-1759215524600-7971d6a4dac0` |
| `slide-07-store.jpg` | Opened the store (lesson) | Retail clothing display on store racks (atelierbyvineeth) | `https://images.unsplash.com/photo-1772570824145-e996a55204fb` |
| `slide-08-tiein.jpg` | Tie-in + citation | reuse `slide-07-store.jpg` | — |

- [ ] **Step 1: Download each image at full quality**

```bash
cd docs/marketing/journey-series/2026-07-07-pilot/images

curl -sL "https://images.unsplash.com/photo-1567159932018-025fbae84a91?fm=jpg&q=80&w=1600&fit=crop&crop=entropy" -o slide-01-hook.jpg
curl -sL "https://images.unsplash.com/photo-1637228393246-c38a4b3d2011?fm=jpg&q=80&w=1600&fit=crop&crop=entropy" -o slide-02-thrift.jpg
curl -sL "https://images.unsplash.com/photo-1624192647570-1131acc12ccf?fm=jpg&q=80&w=1600&fit=crop&crop=entropy" -o slide-03-listing.jpg
curl -sL "https://images.unsplash.com/photo-1712002641088-9d76f9080889?fm=jpg&q=80&w=1600&fit=crop&crop=entropy" -o slide-04-biddingwar.jpg
curl -sL "https://images.unsplash.com/photo-1758351507026-71ad3645cb43?fm=jpg&q=80&w=1600&fit=crop&crop=entropy" -o slide-05-tiktok.jpg
curl -sL "https://images.unsplash.com/photo-1759215524600-7971d6a4dac0?fm=jpg&q=80&w=1600&fit=crop&crop=entropy" -o slide-06-viral.jpg
curl -sL "https://images.unsplash.com/photo-1772570824145-e996a55204fb?fm=jpg&q=80&w=1600&fit=crop&crop=entropy" -o slide-07-store.jpg
cp slide-07-store.jpg slide-08-tiein.jpg
```

`w=1600` with `fit=crop&crop=entropy` gives a high-resolution source that's still safely larger than the 1080×1350 export target after CSS `object-fit:cover` crops it to the frame.

- [ ] **Step 2: Verify each file is a valid real photo at sufficient resolution**

Run: `file docs/marketing/journey-series/2026-07-07-pilot/images/*.jpg`
Expected: all 7 files report as `JPEG image data`, each at least 1080px on the shorter side (check with `sips -g pixelWidth -g pixelHeight <file>` on macOS).

- [ ] **Step 3: Record source + license for each image**

Create `docs/marketing/journey-series/2026-07-07-pilot/images/CREDITS.md`:

```markdown
# Image sources — Journey Series Pilot Post 1 ("The Depop Blowup")

All images are real photography, licensed for commercial use under the standard Unsplash License (free to use, no attribution legally required, attribution given anyway as good practice). None are AI-generated. None are the copyrighted Hypebae/Camila Palacios editorial photos of Emma Rogue's actual store — those are not reproduced anywhere in this post.

| File | Photo | Photographer | Source page | License |
|---|---|---|---|---|
| slide-01-hook.jpg | Black-and-white platform sneakers | Krists Luhaers | unsplash.com/photos/person-showing-black-and-white-platform-sneakers-LD_tZF4cGHI | Unsplash License |
| slide-02-thrift.jpg | Rack of clothes and shoes in a store | Hugo Clément | unsplash.com/photos/JGtPrdnMgQc | Unsplash License |
| slide-03-listing.jpg | Assorted clothes hanged on clothes hanger | Megan Lee | unsplash.com/photos/3BF8aytKNGY | Unsplash License |
| slide-04-biddingwar.jpg | Person holding a cell phone in their hand | Solen Feyissa | unsplash.com/photos/a-person-holding-a-cell-phone-in-their-hand-hWSNT_Pp4x4 | Unsplash License |
| slide-05-tiktok.jpg | Cardboard box sealed with red fragile tape | Ari Sha | unsplash.com/photos/cardboard-box-sealed-with-red-fragile-tape-RqZ-xGRnCYI | Unsplash License |
| slide-06-viral.jpg | Person using smartphone to view social media analytics | (see source page) | unsplash.com/photos/person-using-smartphone-to-view-social-media-analytics-4lKFi3KqnD8 | Unsplash License |
| slide-07-store.jpg | Retail clothing display on store racks | atelierbyvineeth | unsplash.com/photos/clothes-displayed-on-racks-inside-a-store-window-5fdhWc1Vm1s | Unsplash License |
| slide-08-tiein.jpg | (reuses slide-07-store.jpg) | — | — | — |
```

- [ ] **Step 4: Manual check-in — user confirms photo selection before proceeding**

Show the 7 downloaded images to the user (or open the folder) and get a thumbs-up that they read as fitting/authentic before wiring them into the HTML in Task 4. This is a subjective visual call the plan can't automate.

- [ ] **Step 5: Commit**

```bash
git add docs/marketing/journey-series/2026-07-07-pilot/images/
git commit -m "source real licensed photos for journey pilot post"
```

---

### Task 4: Write the render function and post data (8 slides, real content)

**Files:**
- Modify: `docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html` (fill in `/* RENDER FUNCTIONS GO HERE */` and `const posts = [];`)

**Interfaces:**
- Consumes: `.journey-photo` CSS classes from Task 2, image files from Task 3.
- Produces: `buildSlideHTML(s, post)` global function (called by the nav engine's `renderPost()` from Task 1) and a populated `posts` array with 1 post, 8 slides.

- [ ] **Step 1: Replace the render-functions placeholder**

Replace `// ─── RENDER FUNCTIONS GO HERE (Task 4) ──` with:

```javascript
function renderJourneyPhoto(s, post) {
  return `<div class="journey-photo variant-${s.variant}" style="--accent:${post.color}">
    <img class="bg" src="${s.img}" alt="">
    <div class="scrim"></div>
    ${s.chapter ? `<div class="j-chapter">${s.chapter}</div>` : ''}
    <div class="content">
      ${s.badge ? `<span class="j-badge">${s.badge}</span>` : ''}
      <div class="j-caption">${s.caption}</div>
      ${s.swipe ? `<div class="j-swipe">${s.swipe}</div>` : ''}
      ${s.citation ? `<div class="j-citation">${s.citation}</div>` : ''}
    </div>
  </div>`;
}

function buildSlideHTML(s, post) {
  return renderJourneyPhoto(s, post);
}
```

- [ ] **Step 2: Replace the post-data placeholder**

Replace `const posts = [];` with:

```javascript
const posts = [
  {
    label: 'JOURNEY SERIES · TRUE STORY · RESELLERS',
    color: '#6b5744',
    fontClass: '',
    slides: [
      { variant:'hook', img:'images/slide-01-hook.jpg',
        badge:'True Story',
        caption:'She listed shoes that didn’t even fit her.',
        swipe:'swipe for what happened →' },
      { variant:'beat', img:'images/slide-02-thrift.jpg', chapter:'01 / 06',
        caption:'Thrifted with her mom after every gymnastics practice.' },
      { variant:'beat', img:'images/slide-03-listing.jpg', chapter:'02 / 06',
        caption:'Found a pair of 90s platform sneakers. Too small for her.' },
      { variant:'beat', img:'images/slide-04-biddingwar.jpg', chapter:'03 / 06',
        caption:'Listed them on Depop anyway. A bidding war broke out.' },
      { variant:'beat', img:'images/slide-05-tiktok.jpg', chapter:'04 / 06',
        caption:'Posted a TikTok of herself packing the orders.' },
      { variant:'beat', img:'images/slide-06-viral.jpg', chapter:'05 / 06',
        caption:'6 million views in a week. 40,000 new followers overnight.' },
      { variant:'lesson', img:'images/slide-07-store.jpg', chapter:'06 / 06',
        caption:'One bidding war became a real vintage store on the Lower East Side.' },
      { variant:'tie-in', img:'images/slide-08-tiein.jpg',
        caption:'Somewhere in a closet is the next pair like that one.',
        citation:'Story: Emma Rogue, reported by i-D, Hypebae &amp; Elite Daily. Crawli helps resellers find the next one faster.' }
    ]
  }
];
```

- [ ] **Step 3: Verify all 8 slides render correctly**

Run: `open docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html`
Expected: cycling through all 8 slides with the `→` button shows a real photo + caption on each, the chapter counter appears on slides 2-7 only, the badge appears only on slide 1, and the citation line appears only on slide 8. No "undefined" or blank slides. Check console for zero errors.

- [ ] **Step 4: Verify no banned CTA language anywhere**

Run: `grep -inE "thecrawli\.com|search crawli|download|link in bio" docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html`
Expected: no matches (empty output).

- [ ] **Step 5: Verify the tie-in slide doesn't imply Emma endorses Crawli**

Manually re-read slide 8's `caption` and `citation` text — confirm neither sentence has Emma as the subject of any Crawli-related clause (the citation names her only in the "story reported by" context, the Crawli sentence is a separate, general statement about resellers).

- [ ] **Step 6: Commit**

```bash
git add docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html
git commit -m "add journey pilot post data and render function (8 slides)"
```

---

### Task 5: Write the caption file

**Files:**
- Create: `docs/marketing/journey-series/2026-07-07-pilot/post-captions.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a caption file matching the existing `post-captions.md` format used by every prior batch.

- [ ] **Step 1: Write the caption**

Create `docs/marketing/journey-series/2026-07-07-pilot/post-captions.md`:

```markdown
# Journey Series — Pilot Post 1

## Post 1: The Depop Blowup

**TikTok Title:**
She listed shoes that didn't fit her. A bidding war changed everything.

**TikTok Description:**
This is a true story about how one Depop listing turned into a real vintage store.

She started thrifting with her mom after gymnastics practice, years before any of this. One day she found a pair of 90s platform sneakers that were too small for her. She listed them on Depop anyway.

A bidding war broke out. That's the moment she knew she had something.

She posted a TikTok showing how she packs her Depop orders. It hit 6 million views in a week. She woke up with 40,000 new followers and 300 orders to fill.

That single listing eventually became a real vintage store on New York's Lower East Side.

Story reported by i-D, Hypebae, and Elite Daily. If you're a reseller sitting on a closet full of "maybe someone wants this" pieces, this is basically the whole playbook: post it, let the right buyer find it. Crawli is built for the part after that, finding what's already out there before you list.

#thrifting #reselling #depop #vintagefashion #secondhandstyle
```

- [ ] **Step 2: Verify title length and hashtag count**

Run:
```bash
python3 -c "
title = \"She listed shoes that didn't fit her. A bidding war changed everything.\"
print('title chars:', len(title))
"
grep -o '#[a-zA-Z0-9]*' docs/marketing/journey-series/2026-07-07-pilot/post-captions.md | wc -l
```
Expected: title chars ≤ 90; hashtag count = 5.

- [ ] **Step 3: Verify no banned CTA language in the caption**

Run: `grep -inE "thecrawli\.com|search crawli|download|link in bio" docs/marketing/journey-series/2026-07-07-pilot/post-captions.md`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/marketing/journey-series/2026-07-07-pilot/post-captions.md
git commit -m "add journey pilot post caption"
```

---

### Task 6: Write the journey-series README

**Files:**
- Create: `docs/marketing/journey-series/README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: a series-level doc mirroring how `POSTS_README.md` documents the fact-carousel format, scoped to this new series.

- [ ] **Step 1: Write the README**

Create `docs/marketing/journey-series/README.md`:

```markdown
# Crawli Journey Series

Pubity-style narrative carousels: one real, documented person's story told in short chronological beats (hook → 5-6 beats → lesson → soft tie-in), instead of the fact-carousel format's listicle structure. See `docs/superpowers/specs/2026-07-07-journey-carousel-format-design.md` for the full design rationale.

## Format

8 slides: hook (unresolved tension, no name yet) → 5 beats (one real photo + one short line each, 5-12 words) → lesson (the arc resolves into one takeaway) → tie-in (soft Crawli aside, decoupled from the subject's story, plus a source citation).

## Photo policy

Real photography only, no AI generation, no unlicensed third-party press photos. Priority order:
1. Free commercial-use licensed stock (Unsplash License / Pexels License) of the literal object/scene.
2. The subject's own public social content (screenshot/frame), where directly commenting on that specific post — not yet used in this pilot; a future post could add this if the footage is actually sourced.
3. AI-generated b-roll — last resort only, never a fabricated face of the real person.

Every post's `images/CREDITS.md` records the source URL and license for each photo.

## Protagonist policy

Real names and real, publicly reported story facts are used under editorial commentary — we are retelling and citing an already-published story, not fabricating one or using someone's likeness to imply endorsement. The final slide always carries a source citation (outlet names). The Crawli tie-in never implies the subject uses or endorses Crawli.

## Visual system — signature look (fixed across the series)

Font pairing: Fraunces (headings/captions) + Work Sans (small UI text). Layout: full-bleed real photo + bottom scrim + chapter counter (beats only) + one caption line. This look is intentionally **fixed** across every journey post — unlike the fact-carousel batches, which rotate font/layout/placement every batch, this series stays visually consistent so it reads as a recognizable format. Only the accent color varies per story.

## Batch index

| Date | Folder | Post | Subject |
|---|---|---|---|
| 2026-07-07 | `2026-07-07-pilot/` | 1 | The Depop Blowup — Emma Rogue |

## Caption format

Same TikTok title/description rules as the fact-carousel series (`../POSTS_README.md` "Caption Format" section), plus a source-citation line in the description naming the real person and outlets.
```

- [ ] **Step 2: Commit**

```bash
git add docs/marketing/journey-series/README.md
git commit -m "add journey-series README"
```

---

### Task 7: Export slides and verify output

**Files:**
- Modify: `docs/marketing/export-slides.js:42` (default `BATCH` constant is not changed — export via `--batch=` flag instead, per the spec's finding that `path.resolve` already handles nested paths)

**Interfaces:**
- Consumes: `docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html` from Task 4.
- Produces: `docs/marketing/journey-series/2026-07-07-pilot/exports/carousel/post-01/slide-01.png` through `slide-08.png`.

- [ ] **Step 1: Update SLIDE_COUNTS for this export**

In `docs/marketing/export-slides.js`, find the `SLIDE_COUNTS` array declaration (near line 50+, same file where prior batches appended a comment showing their array). Add a comment noting this run's override — since this is a one-off folder outside the normal dated-batch sequence, temporarily set:

```javascript
const SLIDE_COUNTS = [8]; // 2026-07-07 journey-series pilot: 1 post, 8 slides
```

Note: this line normally holds the *current default batch's* counts. Since exporting the journey pilot is a one-off run, set it to `[8]` before running Step 2, then restore it to whatever the last fact-carousel batch had it set to afterward (Step 4) so the default `node export-slides.js` with no `--batch` flag still exports the right thing for the fact-carousel series.

- [ ] **Step 2: Run the export**

```bash
cd docs/marketing
node export-slides.js --batch=journey-series/2026-07-07-pilot
```

Expected: console output showing 8 slides exported for post-01, no errors.

- [ ] **Step 3: Verify no blank/undersized frames**

```bash
find docs/marketing/journey-series/2026-07-07-pilot/exports -name "*.png" -size -50k
```
Expected: empty output (no files under 50KB — a blank/undersized frame is the known failure mode documented in `POSTS_README.md`'s "Build note" from Day 6).

```bash
ls -la docs/marketing/journey-series/2026-07-07-pilot/exports/carousel/post-01/
```
Expected: exactly 8 PNG files, each with a non-trivial file size (compare against a known-good prior batch's file sizes, roughly 200KB-1.5MB range for photo-heavy slides).

- [ ] **Step 4: Restore SLIDE_COUNTS to the fact-carousel default**

Revert the `SLIDE_COUNTS` line in `docs/marketing/export-slides.js` back to whatever it was before Step 1 (check `git diff docs/marketing/export-slides.js` to confirm you're restoring the exact prior value, e.g. `[7,7,7,4,7,7,4,7]` for the 2026-07-02 batch — do not guess, read the pre-change value from git).

- [ ] **Step 5: Commit**

```bash
git add docs/marketing/journey-series/2026-07-07-pilot/exports/ docs/marketing/export-slides.js
git commit -m "export journey pilot post slides"
```

---

### Task 8: Final review handoff

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Open the exported PNGs and the live HTML for final visual check**

```bash
open docs/marketing/journey-series/2026-07-07-pilot/exports/carousel/post-01/
open docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html
```

- [ ] **Step 2: Re-run every grep-based safety check as a final pass**

```bash
grep -inE "thecrawli\.com|search crawli|download|link in bio" docs/marketing/journey-series/2026-07-07-pilot/content-posts-slides.html docs/marketing/journey-series/2026-07-07-pilot/post-captions.md
```
Expected: no matches.

- [ ] **Step 3: Hand off to user**

Report: folder location, what to check (photo/caption fit, the tie-in slide's tone, the source citation), and that this is a pilot — no `content_history` marking, no posting, until the user reviews and approves the format itself.

No commit needed for this task (verification only).
