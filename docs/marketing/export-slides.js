/**
 * Export all Crawli content slides as high-res PNGs.
 *
 * Usage:
 *   cd docs/marketing
 *   npm install puppeteer            (one-time)
 *   node export-slides.js            (exports current batch)
 *   node export-slides.js --batch=2026-06-22  (exports a specific batch)
 *
 * Batch structure:
 *   docs/marketing/
 *     YYYY-MM-DD/
 *       content-posts-slides.html    ← source
 *       exports/carousel/post-01/    ← output
 *
 * Output size: 1080×1920 (9:16, TikTok full-screen photo post)
 * Output resolution: 2160×3840px (2× DPR — downscaled cleanly by platforms)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ── config ────────────────────────────────────────────────────────────────────
// TikTok-only, full-screen vertical (9:16) is the default since 2026-06-19.
// Templates should keep critical text inside a safe zone (roughly top 75-80%,
// left ~85%) so TikTok's own UI chrome (caption, like/comment/share, profile,
// sound disc — bottom ~20% and right ~15% of the frame) never covers it. The
// background image/photo can still bleed fully edge to edge.
const width  = 1080;
const height = 1920;

// --batch=YYYY-MM-DD selects the batch folder; defaults to most recent
const batchArg = process.argv.find(a => a.startsWith('--batch='));
const BATCH = batchArg ? batchArg.split('=')[1] : '2026-06-22';

// Number of slides per post for this batch (cover + steps + cta)
// Update this array when creating a new batch.
// 2026-06-15: [8, 7, 5, 8, 6, 8, 7, 8, 8, 7]
// 2026-06-16: [7, 6, 8, 8, 7, 8, 7, 8, 8, 8, 6, 8]
// 2026-06-18: [8, 8, 8, 8, 7, 8, 7, 6, 7, 7, 6, 7, 8, 7, 7, 7]
// 2026-06-22: [7,7, 7,7,7,7,7, 6] (posts 1-2 approved, 3-8 added same session)
const SLIDE_COUNTS = [7, 7, 7, 7, 7, 7, 7, 6];

const HTML_FILE  = path.resolve(__dirname, BATCH, 'content-posts-slides.html');
const OUTPUT_DIR = path.resolve(__dirname, BATCH, 'exports', 'carousel');

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
  // DESIGN_H is derived from the output aspect ratio (not hardcoded) so it always
  // matches width/height above — this is what broke when 9:16 was first considered:
  // changing width/height alone left the frame the old 4:5 shape with blank space.
  const DESIGN_W = 440;
  const DESIGN_H = Math.round(DESIGN_W * (height / width));
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
  console.log(`Image size: ${width * 2}×${height * 2}px (2× retina, displays at ${width}×${height})`);
})();
