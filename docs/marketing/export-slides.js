/**
 * Export all Crawli content slides as high-res PNGs.
 *
 * Usage:
 *   cd docs/marketing
 *   npx puppeteer-cli ... OR:
 *
 *   npm install puppeteer   (one-time)
 *   node export-slides.js
 *
 * Output:
 *   docs/marketing/exports/post-01/slide-01.png ... etc.
 *
 * Sizes:
 *   --size=carousel  → 1080×1350  (Instagram carousel, TikTok photo post)
 *   --size=story     → 1080×1920  (Instagram/TikTok Story)
 *
 * Default: carousel (1080×1350)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ── config ────────────────────────────────────────────────────────────────────
// carousel = 1080×1350 (4:5) — Instagram feed, carousel posts, TikTok photo post
// story = not supported yet (9:16 frame doesn't match the 4:5 slide layout)
const SIZES = {
  carousel: { width: 1080, height: 1350 },
};

const arg = process.argv.find(a => a.startsWith('--size='));
const sizeKey = arg ? arg.split('=')[1] : 'carousel';
const { width, height } = SIZES[sizeKey] || SIZES.carousel;

// Number of slides per post (cover + steps + cta)
const SLIDE_COUNTS = [8, 7, 5, 8, 6, 8, 7, 8, 8, 7];

const HTML_FILE = path.resolve(__dirname, 'content-posts-slides.html');
const OUTPUT_DIR = path.resolve(__dirname, 'exports', sizeKey);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(HTML_FILE)) {
    console.error('HTML file not found:', HTML_FILE);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Viewport = exact output size. DPR=2 (integer) so Chrome renders text at native
  // 2× resolution — avoids the sub-pixel blurring of a fractional DPR like 2.4545.
  // CSS zoom scales the 440px-wide frame design up to fill the full 1080px viewport
  // without changing any font sizes or layout proportions in the source HTML.
  const DESIGN_W = 440;
  const DESIGN_H = 550;
  const zoom = width / DESIGN_W; // e.g. 1080/440 ≈ 2.454 applied at CSS level

  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle0' });

  await page.addStyleTag({ content: `
    body { padding: 0 !important; margin: 0 !important; overflow: hidden !important; }
    .top-bar, .post-label, .bot-bar { display: none !important; }
    #frame {
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: ${DESIGN_W}px !important;
      max-width: none !important;
      height: ${DESIGN_H}px !important;
      aspect-ratio: unset !important;
      zoom: ${zoom} !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
  ` });

  let total = 0;

  for (let pi = 0; pi < SLIDE_COUNTS.length; pi++) {
    const postDir = path.join(OUTPUT_DIR, `post-${String(pi + 1).padStart(2, '0')}`);
    fs.mkdirSync(postDir, { recursive: true });

    // Jump to post
    await page.evaluate(`jumpPost(${pi})`);
    await sleep(200);

    for (let si = 0; si < SLIDE_COUNTS[pi]; si++) {
      await page.evaluate(`gotoSlide(${si})`);
      await sleep(100);

      const outPath = path.join(postDir, `slide-${String(si + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: outPath });

      total++;
      console.log(`  ✓ post-${String(pi+1).padStart(2,'0')} / slide-${String(si+1).padStart(2,'0')}.png`);
    }
  }

  await browser.close();

  console.log(`\nDone. ${total} slides saved to:\n  ${OUTPUT_DIR}`);
  console.log(`\nImage size: ${width * 2}×${height * 2}px (2× retina, displays at ${width}×${height})`);
})();
