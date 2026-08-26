#!/usr/bin/env python3
"""Patch weekly-seo-brief: surface per-page GSC performance (clicks/impressions
already fetched via dimensions:['query','page'] but previously discarded after
the 'page' key was parsed) matched against published_posts.slug/topic_key, and
feed it into the keyword-map prompt so the weekly brief (and therefore daily
ideation, via seo_context.keywords_json.dailyContext) knows which published
topics already have real click data vs impressions-but-no-clicks.

Operates on the current source-of-truth JSON (matches by node name only;
schedule, ids, credentials untouched).

Usage: _update_weekly_seo_brief_page_perf.py [INPUT_PATH] [OUTPUT_PATH]
"""
import json, os, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "docs/workflows/weekly-seo-brief.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else PATH
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # service_role: never hardcode

PROCESS_GSC_JS = r'''const rows = $input.first().json.rows || [];
const startDate = $('Date setup').first().json.startDate;
const endDate = $('Date setup').first().json.endDate;
const weekLabel = $('Date setup').first().json.weekLabel;
const weekOf = $('Date setup').first().json.weekOf;

const parsed = rows.map(function(r) {
  return {
    query: r.keys[0],
    page: r.keys[1],
    position: Math.round(r.position * 10) / 10,
    clicks: r.clicks,
    impressions: r.impressions
  };
}).sort(function(a, b) { return b.impressions - a.impressions; });

const totalClicks = parsed.reduce(function(s, r) { return s + r.clicks; }, 0);
const totalImpressions = parsed.reduce(function(s, r) { return s + r.impressions; }, 0);

const ranked = parsed.filter(function(r) { return r.position < 5; });
const gaps = parsed.filter(function(r) { return r.position >= 5 && r.position <= 20; });
const weakRanking = parsed.filter(function(r) { return r.position > 20; });

let gscBlock = 'GSC DATA: https://thecrawli.com/, last 28 days (' + startDate + ' to ' + endDate + ')\n';
gscBlock += 'Unique queries: ' + parsed.length + ' | Clicks: ' + totalClicks + ' | Impressions: ' + totalImpressions + '\n\n';

if (ranked.length > 0) {
  gscBlock += 'Ranking well (pos 1-4):\n';
  ranked.forEach(function(r) { gscBlock += '  "' + r.query + '" pos ' + r.position + ', ' + r.impressions + ' imp, ' + r.clicks + ' clicks\n'; });
  gscBlock += '\n';
}
if (gaps.length > 0) {
  gscBlock += 'Keyword gaps: low-hanging fruit (pos 5-20, sorted by impressions):\n';
  gaps.forEach(function(r) { gscBlock += '  "' + r.query + '" pos ' + r.position + ', ' + r.impressions + ' imp, ' + r.clicks + ' clicks\n'; });
  gscBlock += '\n';
}
if (weakRanking.length > 0 && weakRanking.length <= 10) {
  gscBlock += 'Weak rankings (pos 20+, worth knowing):\n';
  weakRanking.forEach(function(r) { gscBlock += '  "' + r.query + '" pos ' + r.position + ', ' + r.impressions + ' imp\n'; });
  gscBlock += '\n';
}
if (parsed.length < 5) {
  gscBlock += 'NOTE: Site has very little GSC data: generate keyword map based on niche knowledge.\n';
}

// ---- Per-page performance (the 'page' dimension was already being fetched and
// parsed above, just never aggregated or used until now) ----
const byPage = {};
for (const r of parsed) {
  if (!r.page) continue;
  if (!byPage[r.page]) byPage[r.page] = { page: r.page, clicks: 0, impressions: 0, bestPosition: r.position };
  byPage[r.page].clicks += r.clicks;
  byPage[r.page].impressions += r.impressions;
  if (r.position < byPage[r.page].bestPosition) byPage[r.page].bestPosition = r.position;
}
const pageRows = Object.values(byPage);

// Inline fetch (defensive: zero rows must not break the chain), same pattern as
// daily-content-email's Extract context node for published_posts/reddit_research.
const SUPA_KEY = '__SUPA_KEY__';
let publishedPosts = [];
try {
  const ppResp = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://peyqxfijdrziqfjkxjsn.supabase.co/rest/v1/published_posts?select=slug,topic_key,title',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    json: true,
  });
  if (Array.isArray(ppResp)) publishedPosts = ppResp;
} catch (e) { publishedPosts = []; }

const slugMap = {};
for (const p of publishedPosts) { if (p.slug) slugMap[p.slug] = p; }

function slugFromUrl(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  } catch (e) { return ''; }
}

const matched = [];
for (const pr of pageRows) {
  const slug = slugFromUrl(pr.page);
  const post = slug ? slugMap[slug] : null;
  if (post) {
    matched.push({
      title: post.title,
      topic_key: post.topic_key || '',
      clicks: pr.clicks,
      impressions: pr.impressions,
      bestPosition: Math.round(pr.bestPosition * 10) / 10
    });
  }
}

const performing = matched.filter(function(m) { return m.clicks > 0; }).sort(function(a, b) { return b.clicks - a.clicks; });
const noClicks = matched.filter(function(m) { return m.clicks === 0 && m.impressions > 0; }).sort(function(a, b) { return b.impressions - a.impressions; });

let pagePerfBlock;
if (matched.length > 0) {
  pagePerfBlock = 'PUBLISHED POST PERFORMANCE: last 28 days, matched to published posts:\n';
  if (performing.length > 0) {
    pagePerfBlock += 'Performing (clicks > 0, candidates for a related follow-up post):\n';
    performing.forEach(function(m) { pagePerfBlock += '  "' + m.title + '" [' + m.topic_key + '] - ' + m.clicks + ' clicks, ' + m.impressions + ' imp, avg pos ' + m.bestPosition + '\n'; });
    pagePerfBlock += '\n';
  }
  if (noClicks.length > 0) {
    pagePerfBlock += 'Impressions but zero clicks (title or hook likely needs work, do not repeat the same angle):\n';
    noClicks.forEach(function(m) { pagePerfBlock += '  "' + m.title + '" [' + m.topic_key + '] - ' + m.impressions + ' imp, avg pos ' + m.bestPosition + '\n'; });
    pagePerfBlock += '\n';
  }
} else {
  pagePerfBlock = 'PUBLISHED POST PERFORMANCE: no published posts matched to GSC pages yet (too new, not indexed, or no published_posts rows).\n';
}

return [{ json: { gscBlock, pagePerfBlock, weekLabel, weekOf, startDate, endDate, totalRows: parsed.length, totalClicks, totalImpressions } }];
'''

KEYWORD_MAP_PROMPT = r'''={{ $('Process GSC data').first().json.gscBlock }}

{{ $('Process GSC data').first().json.pagePerfBlock }}

You are building a comprehensive weekly SEO keyword map for Crawli's blog. Crawli is a free tool that searches secondhand fashion marketplaces simultaneously (Depop, Poshmark, Vestiaire Collective, eBay, ThredUp, The RealReal). Readers: resellers, bargain hunters, luxury shoppers going preloved, vintage fans.

This map will be used two ways: (1) emailed to the site owner as a reference for the whole week, (2) stored and fed into daily content generation so every day's blog and social ideas stay keyword-aware. It only runs once a week, so give plenty of options.

Generate the following:
- 10-12 keyword opportunities total. Use the GSC data if there are real gaps; fill in with niche knowledge when data is sparse. Focus on queries people actually search for when buying or selling secondhand fashion.
- 4-5 topic clusters that group related keywords.
- Top 3 priorities for this week: the highest-opportunity targets given current site state.
- A short context note for the daily content generator (what to lean toward this week, any trend worth riding). Factor in PUBLISHED POST PERFORMANCE above: do not recommend a fresh angle on a topic_key that already published and got impressions with zero clicks, unless the angle explicitly changes the hook. Topics with real clicks are good candidates for a related follow-up post.

For each keyword:
- The exact search query as someone would type it
- GSC position if it appears in the data above, otherwise "not ranking"
- Search intent: informational / commercial / navigational
- Audience: resellers / fashionistas / vintage community / all
- One-sentence angle: the specific or counterintuitive take that would beat what's currently ranking
- Format fit: blog / social / both
- Priority: high / medium / low

Tone rules (same rules apply to every word you output):
- No exclamation marks
- No em dashes. Use a comma or restructure.
- No marketing language (not "game-changing", not "ultimate", not "comprehensive guide")
- No preambles (not "In today's world...", not "Whether you're...")
- Angles must be specific and opinionated, not generic

WRONG angle: "A helpful guide to selling on Poshmark for beginners"
RIGHT angle: "Most Poshmark sellers price based on what they paid, not what buyers will pay, which is why most listings never move"

WRONG angle: "Tips for finding great deals on Depop"
RIGHT angle: "Depop's search is keyword-based, not algorithm-based, so sellers who understand search terms get all the visibility"

Return only a JSON object, no markdown, no explanation:
{
  "gscSummary": "2-3 sentences on what GSC shows this week. Be direct. If data is sparse, say so.",
  "keywords": [
    {
      "query": "exact search query",
      "gscPosition": "pos X.X or not ranking",
      "intent": "informational|commercial|navigational",
      "audience": "resellers|fashionistas|vintage community|all",
      "angle": "one sentence, specific and opinionated",
      "formatFit": "blog|social|both",
      "priority": "high|medium|low"
    }
  ],
  "clusters": [
    {
      "name": "cluster name",
      "keywords": ["query 1", "query 2", "query 3"],
      "angle": "one sentence on what makes this cluster worth owning"
    }
  ],
  "topPriorities": [
    {
      "query": "the keyword",
      "why": "1-2 sentences on why this is the highest-opportunity target right now",
      "angle": "the specific take to use"
    }
  ],
  "contextNote": "2-3 sentences for the daily content generator: what to lean toward this week, any trends to ride, what the site needs most right now"
}
'''

raw = json.load(open(PATH))
is_list = isinstance(raw, list)
wf = raw[0] if is_list else raw
nodes = {n['name']: n for n in wf['nodes']}

nodes['Process GSC data']['parameters']['jsCode'] = PROCESS_GSC_JS.replace('__SUPA_KEY__', KEY)
nodes['Generate keyword map']['parameters']['responses']['values'][0]['content'] = KEYWORD_MAP_PROMPT

json.dump(raw if is_list else wf, open(OUT, 'w'), indent=1, ensure_ascii=False)
print("written:", OUT)
print("nodes:", [n['name'] for n in wf['nodes']])
