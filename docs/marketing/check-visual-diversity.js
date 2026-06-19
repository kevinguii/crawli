#!/usr/bin/env node
// Reads visual-history.json + ui-ux-pro-max's color/typography/style data and
// prints what the next batch should lean toward, so a new session checks state
// instead of defaulting to the look of the last batch it can remember.
// Usage: node check-visual-diversity.js [--last=20]

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const lastArg = args.find((a) => a.startsWith('--last='));
const LAST_N = lastArg ? parseInt(lastArg.split('=')[1], 10) : 20;

const HISTORY_PATH = path.join(__dirname, 'visual-history.json');

const IMAGERY_TARGET = { symbol: 0.35, clipart: 0.40, 'ai-raster': 0.25 };
const TYPOGRAPHY_TARGET = { standard: 0.60, editorial: 0.40 };

function loadHistory() {
  const raw = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  return raw.posts;
}

// visual-history.json is appended in chronological order, so the tail of the
// array is the most recent posts - no date sort needed (several early entries
// have date: null, see POSTS_README Batch Index gap noted in the file header).
function recentSlice(posts, n) {
  return posts.slice(Math.max(0, posts.length - n));
}

function tally(posts, field) {
  const counts = {};
  let known = 0;
  for (const p of posts) {
    if (p[field]) {
      counts[p[field]] = (counts[p[field]] || 0) + 1;
      known++;
    }
  }
  return { counts, known };
}

function printRatioReport(label, counts, known, target) {
  console.log(`\n${label} (last ${known} posts with this field recorded):`);
  for (const [key, pct] of Object.entries(target)) {
    const actual = counts[key] || 0;
    const actualPct = known ? actual / known : 0;
    const flag = actualPct + 0.05 < pct ? '  <- under target, lean toward this' : '';
    console.log(`  ${key.padEnd(12)} ${actual}/${known} (${(actualPct * 100).toFixed(0)}%, target ${(pct * 100).toFixed(0)}%)${flag}`);
  }
}

function printUsageCounts(label, counts, known) {
  console.log(`\n${label} (last ${known} posts with this recorded):`);
  const entries = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  for (const [key, n] of entries) {
    console.log(`  ${String(key).padEnd(40)} ${n}`);
  }
  if (entries.length === 1) {
    console.log(`  Only one value ever used (${entries[0][0]}) -> pick a NEW one this batch.`);
  } else if (entries.length) {
    console.log(`  Least used: ${entries[0][0]} -> consider it next.`);
  }
}

// The whole point of the file: surface the immediately-previous batch's exact
// visual choices so the next batch can deliberately differ. Sameness across
// batches (same font, same centered layout) is the recurring failure this guards.
function previousBatchReport(posts) {
  const dated = posts.filter((p) => p.date);
  if (!dated.length) return;
  const lastDate = dated[dated.length - 1].date;
  const lastBatch = dated.filter((p) => p.date === lastDate);
  const uniq = (field) => [...new Set(lastBatch.map((p) => p[field]).filter(Boolean))];
  console.log(`\n=== PREVIOUS BATCH (${lastDate}, ${lastBatch.length} posts) - DO NOT REUSE THESE ===`);
  console.log(`  font_pairing:   ${uniq('font_pairing').join(' | ') || '(not recorded)'}`);
  console.log(`  typography:     ${uniq('typography').join(' | ') || '(not recorded)'}`);
  console.log(`  layout:         ${uniq('layout').join(' | ') || '(not recorded)'}`);
  console.log(`  text_placement: ${uniq('text_placement').join(' | ') || '(not recorded)'}`);
  console.log(`  imagery:        ${uniq('imagery').join(' | ') || '(not recorded)'}`);
  console.log(`  Pick a DIFFERENT font_pairing AND text_placement AND layout for the next batch.`);
}

// Enforce the record-back discipline: if the last shipped batch is missing the
// experimentation axes, the ledger goes blind on exactly the dimensions that
// keep repeating. Warn loudly so the gap gets fixed instead of silently growing.
function enforceRecordBack(posts) {
  const dated = posts.filter((p) => p.date);
  if (!dated.length) return;
  const lastDate = dated[dated.length - 1].date;
  const lastBatch = dated.filter((p) => p.date === lastDate);
  const REQUIRED = ['typography', 'font_pairing', 'layout', 'text_placement', 'imagery'];
  const missing = REQUIRED.filter((f) => lastBatch.every((p) => !p[f]));
  if (missing.length) {
    console.log(`\n!!! BLOCK: last batch (${lastDate}) never recorded: ${missing.join(', ')}.`);
    console.log(`    The diversity check is blind on these axes. Backfill them in visual-history.json before designing.`);
  }
}

// ui-ux-pro-max's plugin version directory changes on update, so glob for it
// instead of hardcoding a version (e.g. 2.5.0).
function findUiUxProMaxDataDir() {
  const base = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'ui-ux-pro-max-skill', 'ui-ux-pro-max');
  if (!fs.existsSync(base)) return null;
  const versions = fs.readdirSync(base).filter((v) => fs.statSync(path.join(base, v)).isDirectory());
  if (!versions.length) return null;
  const dataDir = path.join(base, versions[versions.length - 1], 'src', 'ui-ux-pro-max', 'data');
  return fs.existsSync(dataDir) ? dataDir : null;
}

// Minimal CSV line parser - handles quoted fields containing commas (these
// data files have free-text Notes columns with embedded commas).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}

function suggestColors(dataDir, usedHexes) {
  const csvPath = path.join(dataDir, 'colors.csv');
  if (!fs.existsSync(csvPath)) return [];
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const candidates = [];
  for (const r of rows) {
    const hex = (r.Primary || '').toLowerCase();
    if (hex && !usedHexes.has(hex) && !candidates.some((c) => c.hex === hex)) {
      candidates.push({ hex, name: r['Product Type'] || '', notes: r.Notes || '' });
    }
    if (candidates.length >= 5) break;
  }
  return candidates;
}

function suggestStyleMovements(dataDir, usedStyles) {
  const csvPath = path.join(dataDir, 'styles.csv');
  if (!fs.existsSync(csvPath)) return [];
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const candidates = [];
  for (const r of rows) {
    const name = r['Style Category'] || '';
    if (name && !usedStyles.has(name) && !candidates.some((c) => c.name === name)) {
      candidates.push({ name, keywords: (r.Keywords || '').split(',').slice(0, 4).join(',').trim() });
    }
    if (candidates.length >= 3) break;
  }
  return candidates;
}

function main() {
  const posts = loadHistory();
  const recent = recentSlice(posts, LAST_N);

  const layout = tally(recent, 'layout');
  const typography = tally(recent, 'typography');
  const imagery = tally(recent, 'imagery');
  const textPlacement = tally(recent, 'text_placement');
  const fontPairing = tally(recent, 'font_pairing');

  console.log(`Visual diversity check - ${posts.length} posts total in history, looking at last ${recent.length}.`);

  previousBatchReport(posts);
  enforceRecordBack(posts);

  printUsageCounts('Layout usage', layout.counts, layout.known);
  printUsageCounts('Text placement usage', textPlacement.counts, textPlacement.known);
  printUsageCounts('Font pairing usage', fontPairing.counts, fontPairing.known);
  printRatioReport('Typography track', typography.counts, typography.known, TYPOGRAPHY_TARGET);
  printRatioReport('Imagery type', imagery.counts, imagery.known, IMAGERY_TARGET);

  const usedHexes = new Set(posts.map((p) => (p.color_hex || '').toLowerCase()).filter(Boolean));
  const usedStyles = new Set(posts.map((p) => p.style_movement).filter(Boolean));

  const dataDir = findUiUxProMaxDataDir();
  if (!dataDir) {
    console.log('\nui-ux-pro-max data files not found under ~/.claude/plugins/cache - skipping color/style suggestions. Pick a fresh hex manually and avoid the table in POSTS_README.');
  } else {
    const colorCandidates = suggestColors(dataDir, usedHexes);
    console.log('\nUnused colors from ui-ux-pro-max colors.csv (not in visual-history.json):');
    for (const c of colorCandidates) {
      console.log(`  ${c.hex}  ${c.name}${c.notes ? '  - ' + c.notes : ''}`);
    }

    const styleCandidates = suggestStyleMovements(dataDir, usedStyles);
    console.log('\nUnused style movements from ui-ux-pro-max styles.csv (new variation axis, none used yet):');
    for (const s of styleCandidates) {
      console.log(`  ${s.name}  (${s.keywords})`);
    }
  }

  console.log('\nApply this before designing the next batch - do not default to the last batch\'s look without checking the numbers above.');
}

main();
