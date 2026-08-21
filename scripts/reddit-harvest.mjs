#!/usr/bin/env node
/**
 * Reddit harvester for the audience language file.
 *
 * Collects VERBATIM posts and comments from Reddit so the audience profile and
 * hooks can be written in the words people actually use, rather than in
 * marketing language. See docs/planning/AUDIENCE_AND_HOOKS_PLAN.md.
 *
 * Why this exists rather than reusing what is already here:
 *   - `reddit_research` (Supabase) stores gpt-4o-mini SUMMARIES, not sentences.
 *     Only `title` is verbatim, and 596 of its 1007 rows are r/Depop.
 *   - Zernio (the n8n reddit-monitor path) throttles at ~6-8 searches per run
 *     and returns post metadata only, no comments. See AGENT_PLAN.md 1B.
 *
 * Two keyless stages, both verified working from a residential IP 2026-08-19
 * (the plain `.json` API 403s from here, RSS and shreddit do not):
 *   1. DISCOVERY  https://www.reddit.com/r/<sub>/search.rss?q=...
 *   2. COMMENTS   https://www.reddit.com/svc/shreddit/comments/r/<sub>/t3_<id>?sort=top
 *
 * Output is NDJSON, one thread per line, at docs/marketing/audience/raw/.
 * Resume-safe: re-running skips post ids already present in the output file.
 *
 * Usage:
 *   node scripts/reddit-harvest.mjs --cohort reseller
 *   node scripts/reddit-harvest.mjs --cohort buyer --limit 40
 *   node scripts/reddit-harvest.mjs --subs Flipping,reselling --queries "sourcing,what to pay"
 *   node scripts/reddit-harvest.mjs --cohort reseller --no-comments   (fast dry run)
 *   node scripts/reddit-harvest.mjs --cohort buyer --delay 3000        (if throttled)
 */

import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const OUT_DIR = 'docs/marketing/audience/raw';

/** Accounts whose comments are automated boilerplate, not user language. */
const BOT_AUTHORS = new Set(['automoderator', 'automod', 'reddit', 'botdefense']);

/** Bodies matching these are bot boilerplate even from a non-bot-named account. */
const BOT_BODY_PATTERNS = [
  /I am a bot/i,
  /this action was performed automatically/i,
  /contact the moderators of this subreddit/i,
];

// Politeness. These are public keyless endpoints being used at low volume;
// the delay is deliberate and should not be tuned down.
let DELAY_MS = 1500;
// A query that loses its retries is silently dropped for that pass, which is
// worse than a slow one: on the 2026-08-20 reseller run, 11 of 24 queries came
// back empty purely from throttling. Backoff is capped so late attempts stay
// minutes rather than hours.
const MAX_RETRIES = 5;
const MAX_BACKOFF_MS = 120_000;

/**
 * Cohorts mirror the two audiences the plan needs to compare (F2b): people
 * sourcing to resell, and people hunting a piece for themselves. r/Flipping is
 * the important one and is entirely absent from `reddit_research`.
 */
const COHORTS = {
  reseller: {
    subs: ['Flipping', 'reselling', 'Depop', 'poshmark'],
    queries: [
      'sourcing',
      'what to pay',
      'comps',
      'did I overpay',
      'pricing',
      'profit margin',
    ],
  },
  buyer: {
    subs: ['Depop', 'vinted', 'poshmark', 'malefashionadvice'],
    queries: [
      'where do I find',
      'looking for',
      'price comparison',
      'cheapest',
      'search is bad',
      'cant find',
    ],
  },
};

// ---------------------------------------------------------------- utilities

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

/**
 * Reddit's Atom feed escapes the post body twice: the XML escapes the HTML, and
 * the HTML itself carries numeric entities (`won&amp;#39;t`). Unescaping once
 * leaves `&#39;` sitting in what is supposed to be verbatim text, so this runs
 * to a fixed point (bounded, so a literal "&amp;" in someone's post cannot loop).
 */
function unescapeEntities(text, passes = 3) {
  let out = text;
  for (let i = 0; i < passes; i++) {
    const before = out;
    out = out
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
    if (out === before) break;
  }
  return out;
}

/** Strip HTML tags to plain text, preserving paragraph breaks. */
function htmlToText(html) {
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : '';
}

async function fetchText(url, label) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
      if (res.status === 429 || res.status >= 500) {
        // Back off hard: a 429 here means we are being told to slow down, and
        // hammering a keyless public endpoint is how it stops being available.
        const wait = Math.min(DELAY_MS * Math.pow(3, attempt), MAX_BACKOFF_MS);
        console.warn(`  ! ${label} HTTP ${res.status}, backing off ${wait}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.warn(`  ! ${label} HTTP ${res.status}, giving up on this item`);
        return null;
      }
      return await res.text();
    } catch (err) {
      console.warn(`  ! ${label} ${err.message} (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(DELAY_MS * attempt);
    }
  }
  return null;
}

// ---------------------------------------------------------------- discovery

/** Parse one Atom <entry> into a thread record. Returns null if unusable. */
function parseEntry(entryXml) {
  const id = tag(entryXml, 'id').replace(/^t3_/, '');
  if (!id) return null;

  const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"/);
  const url = linkMatch ? unescapeEntities(linkMatch[1]) : '';

  const subMatch = entryXml.match(/<category[^>]+term="([^"]+)"/);

  // The content block is the post body plus a "submitted by ... [link]" footer
  // that Reddit appends. Everything from SC_ON onward is that footer.
  const rawContent = tag(entryXml, 'content');
  const decodedOnce = unescapeEntities(rawContent);
  const bodyHtml = decodedOnce.split('<!-- SC_ON -->')[0].replace('<!-- SC_OFF -->', '');

  return {
    post_id: id,
    subreddit: subMatch ? subMatch[1] : '',
    title: unescapeEntities(tag(entryXml, 'title')).trim(),
    author: unescapeEntities(tag(entryXml, 'name')).replace(/^\/u\//, ''),
    url,
    published: tag(entryXml, 'published'),
    selftext: htmlToText(bodyHtml),
    comments: [],
  };
}

async function discover(sub, query, limit) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.rss`
    + `?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=${limit}`;
  const xml = await fetchText(url, `rss r/${sub} "${query}"`);
  if (!xml) return [];

  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.map(parseEntry).filter(Boolean);
}

// ---------------------------------------------------------------- comments

/**
 * Parse <shreddit-comment> elements out of the comments partial.
 *
 * Each comment's body lives in a div whose id embeds that comment's thingId, so
 * the body is looked up by anchor rather than by position. Without that, a
 * nested reply's text gets attributed to its parent.
 *
 * Unlike the reference implementation in the last30days plugin, bodies are NOT
 * truncated: a language file needs the whole sentence, typos and all.
 */
function parseComments(html) {
  const out = [];
  // Require whitespace after the element name: `\b` would also match
  // <shreddit-comment-action-row> and friends, since "-" is a word boundary.
  const openTags = html.match(/<shreddit-comment\s[^>]*>/g) || [];

  for (const tagStr of openTags) {
    const attr = (name) => {
      const m = tagStr.match(new RegExp(`\\b${name}="([^"]*)"`));
      return m ? unescapeEntities(m[1]) : '';
    };

    const author = attr('author') || '[deleted]';
    if (author === '[deleted]' || author === '[removed]') continue;
    // Moderator bots are not user language. On the first real run AutoModerator
    // boilerplate ("I am a bot and this action was performed automatically")
    // was the single most repeated phrase in the corpus, which would have
    // poisoned any frequency analysis of what people actually say.
    if (BOT_AUTHORS.has(author.toLowerCase())) continue;

    const thingId = attr('thingId');
    if (!thingId) continue;

    const anchor = `id="${thingId}-post-rtjson-content"`;
    const idx = html.indexOf(anchor);
    if (idx === -1) continue;

    // Bound the slice so a comment cannot swallow text that is not its own.
    // Three bounds, nearest wins:
    //   - the next comment's body anchor (stops a parent eating its children)
    //   - the next <shreddit-comment> open tag (same, for siblings)
    //   - the next </shreddit-comment> close tag
    // The third is what saves the LAST comment on the page: it has no following
    // anchor, so without it the window runs to end-of-document and picks up the
    // Reply/Share UI chrome and an inline SML.load([...]) script blob. That bug
    // contaminated 36 of 2880 comments on the first real run.
    let window = html.slice(idx + anchor.length);
    const bounds = [
      window.search(/id="t1_[^"]*-post-rtjson-content"/),
      window.search(/<shreddit-comment\s/),
      window.indexOf('</shreddit-comment>'),
    ].filter((i) => i !== -1);
    if (bounds.length > 0) window = window.slice(0, Math.min(...bounds));

    const paras = window.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
    if (paras.length === 0) continue;

    const body = unescapeEntities(htmlToText(paras.join('')));
    if (!body || body === '[deleted]' || body === '[removed]') continue;
    if (BOT_BODY_PATTERNS.some((re) => re.test(body))) continue;

    out.push({
      author,
      score: Number.parseInt(attr('score') || '0', 10) || 0,
      body,
      permalink: attr('permalink'),
      created: attr('created'),
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * Fetch the top-sorted comments partial for one thread.
 *
 * KNOWN LIMIT, and it is deliberate: this returns the first page only, which in
 * practice is the top-level comments plus their first level of replies. Deeper
 * reply chains sit behind "more replies" controls that lazy-load separately and
 * are NOT fetched. For a language file that is the right trade: top-scored
 * top-level comments are where people state their problem plainly, and deep
 * chains are usually two users arguing. `deferred_replies` records when a thread
 * had more, so nobody later mistakes this for a complete capture.
 */
async function fetchComments(sub, postId) {
  const url = `https://www.reddit.com/svc/shreddit/comments/r/${encodeURIComponent(sub)}/t3_${postId}?sort=top`;
  const html = await fetchText(url, `comments ${postId}`);
  if (!html) return { comments: [], deferred_replies: 0 };
  return {
    comments: parseComments(html),
    deferred_replies: (html.match(/more repl/gi) || []).length,
  };
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const cohortName = typeof args.cohort === 'string' ? args.cohort : null;
  if (cohortName && !COHORTS[cohortName]) {
    console.error(`Unknown cohort "${cohortName}". Known: ${Object.keys(COHORTS).join(', ')}`);
    process.exit(1);
  }

  const subs = typeof args.subs === 'string'
    ? args.subs.split(',').map((s) => s.trim()).filter(Boolean)
    : COHORTS[cohortName ?? 'reseller'].subs;
  const queries = typeof args.queries === 'string'
    ? args.queries.split(',').map((s) => s.trim()).filter(Boolean)
    : COHORTS[cohortName ?? 'reseller'].queries;

  const limit = Number.parseInt(args.limit ?? '25', 10);
  // Raise the delay when Reddit is throttling: these are keyless public
  // endpoints and the right response to a 429 is to go slower, not harder.
  if (typeof args.delay === 'string') DELAY_MS = Number.parseInt(args.delay, 10);
  const withComments = !args['no-comments'];
  const label = cohortName ?? 'custom';
  const outFile = typeof args.out === 'string'
    ? args.out
    : path.join(OUT_DIR, `${label}-${new Date().toISOString().slice(0, 10)}.ndjson`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  // Resume: never re-fetch a thread already in the output file.
  const seen = new Set();
  if (fs.existsSync(outFile)) {
    for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { seen.add(JSON.parse(line).post_id); } catch { /* skip malformed line */ }
    }
    console.log(`Resuming: ${seen.size} threads already in ${outFile}`);
  }

  console.log(`\nCohort: ${label}`);
  console.log(`Subs:    ${subs.join(', ')}`);
  console.log(`Queries: ${queries.join(' | ')}`);
  console.log(`Comments: ${withComments ? 'yes' : 'no (dry run)'}\n`);

  const perSub = {};
  const threads = [];

  for (const sub of subs) {
    perSub[sub] = { threads: 0, comments: 0 };
    for (const query of queries) {
      const found = await discover(sub, query, limit);
      const fresh = found.filter((t) => !seen.has(t.post_id));
      for (const t of fresh) seen.add(t.post_id);
      console.log(`  r/${sub} "${query}" -> ${found.length} results, ${fresh.length} new`);
      threads.push(...fresh);
      perSub[sub].threads += fresh.length;
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n${threads.length} new threads discovered. ${withComments ? 'Fetching comments...' : 'Skipping comments.'}\n`);

  const out = fs.createWriteStream(outFile, { flags: 'a' });
  let done = 0;
  for (const thread of threads) {
    if (withComments) {
      const result = await fetchComments(thread.subreddit || subs[0], thread.post_id);
      thread.comments = result.comments;
      thread.deferred_replies = result.deferred_replies;
      perSub[thread.subreddit] = perSub[thread.subreddit] || { threads: 0, comments: 0 };
      perSub[thread.subreddit].comments += thread.comments.length;
      await sleep(DELAY_MS);
    }
    thread.harvested_at = new Date().toISOString();
    out.write(JSON.stringify(thread) + '\n');
    done++;
    if (done % 10 === 0) console.log(`  ...${done}/${threads.length}`);
  }
  out.end();

  // The plan's volume gate: report per-sub counts so thin data is visible
  // BEFORE anyone analyses it.
  console.log('\n=== per-subreddit yield ===');
  for (const [sub, counts] of Object.entries(perSub)) {
    const thin = counts.threads < 20 ? '  <-- THIN, under 20 threads' : '';
    console.log(`  r/${sub.padEnd(20)} ${String(counts.threads).padStart(4)} threads  ${String(counts.comments).padStart(5)} comments${thin}`);
  }
  const totalComments = Object.values(perSub).reduce((a, b) => a + b.comments, 0);
  console.log(`\n  TOTAL ${threads.length} threads, ${totalComments} comments`);
  console.log(`  Written to ${outFile}\n`);
}

main().catch((err) => {
  console.error('harvest failed:', err);
  process.exit(1);
});
