#!/usr/bin/env python3
"""Patch daily-content-email: add a TikTok performance signal to the social
ideation prompt, sourced from tiktok_performance (written weekly by
tiktok-performance-digest.json, previously read only by that one-off digest
email — nothing fed it back into ideation).

No topic_key/join key exists on tiktok_performance yet (tiktok-auto-post.json,
which would eventually create that link, is not in use per the latest commit),
so this surfaces qualitative free-text signal (caption + hashtags + engagement)
the same way reddit_research.pain_point/summary are already injected as free
text rather than a structured join.

Operates on the current source-of-truth JSON (matches by node name only;
schedule, ids, credentials untouched). Only modifies Extract context's jsCode.

Usage: _update_daily_email_tiktok_perf.py [INPUT_PATH] [OUTPUT_PATH]
"""
import json, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "docs/workflows/daily-content-email.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else PATH

raw = json.load(open(PATH))
is_list = isinstance(raw, list)
wf = raw[0] if is_list else raw
nodes = {n['name']: n for n in wf['nodes']}

js = nodes['Extract context']['parameters']['jsCode']

ANCHOR = "// ---- SEO keyword injection ----"
if ANCHOR not in js:
    print("ERROR: anchor not found, refusing to patch blind", file=sys.stderr)
    sys.exit(1)
if "tiktok_performance" in js:
    print("ERROR: TikTok performance block already present, aborting to avoid double-patch", file=sys.stderr)
    sys.exit(1)

TIKTOK_BLOCK = r'''// ---- TikTok performance signal (qualitative - no topic_key join exists yet,
// tiktok-auto-post.json isn't live, so this is free text like reddit_research,
// not a structured match) ----
let tiktokRows = [];
try {
  const tkResp = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://peyqxfijdrziqfjkxjsn.supabase.co/rest/v1/tiktok_performance?select=content_snippet,hashtags,media_type,views,likes,comments,shares,engagement_rate&order=engagement_rate.desc&limit=50',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    json: true,
  });
  if (Array.isArray(tkResp)) tiktokRows = tkResp;
} catch (e) { tiktokRows = []; }

const TIKTOK_VIEW_FLOOR = 20;
const TIKTOK_MIN_ROWS = 8;
const tkQualifying = tiktokRows.filter(function(r) { return (r.views || 0) >= TIKTOK_VIEW_FLOOR; });
const renderTkRow = function(r) {
  return '"' + String(r.content_snippet || '').slice(0, 140) + '" [' + (r.media_type || 'unknown') + ', ' + (r.hashtags || []).slice(0, 4).join(' ') + '] - ' + (Math.round((r.engagement_rate || 0) * 1000) / 10) + '% engagement, ' + (r.views || 0) + ' views';
};

let tiktokPerfBlock = '';
let tiktokPerfSummary = [];
if (tkQualifying.length >= TIKTOK_MIN_ROWS) {
  const tkSorted = tkQualifying.slice().sort(function(a, b) { return (b.engagement_rate || 0) - (a.engagement_rate || 0); });
  const tkTop5 = tkSorted.slice(0, 5);
  const tkBottom5 = tkSorted.slice(-5).reverse();
  tiktokPerfBlock = 'Top performing TikToks (highest engagement rate):\n' + tkTop5.map(function(r) { return '  ' + renderTkRow(r); }).join('\n')
    + '\n\nLowest performing TikToks (for contrast, avoid repeating these patterns):\n' + tkBottom5.map(function(r) { return '  ' + renderTkRow(r); }).join('\n');
  tiktokPerfSummary = tkTop5.map(function(r) { return { content_snippet: r.content_snippet, engagement_rate: r.engagement_rate }; });
}
const tiktokPerfSocialSection = tiktokPerfBlock
  ? '\n\nReal TikTok performance data from recent posts (use to inform tone, hook style, and hashtag territory for 2-3 of the 15 ideas, not a hard rule):\n' + tiktokPerfBlock + '\n\nLean into hook/format/hashtag patterns associated with the top performers above. Avoid patterns associated with the lowest performers.'
  : '';

'''

js = js.replace(ANCHOR, TIKTOK_BLOCK + ANCHOR)

js = js.replace(
    "const socialPrompt = socialIntro + socialSeoSection + redditPainSocialSection + takenKeysBlock + socialDedup + socialTail;",
    "const socialPrompt = socialIntro + socialSeoSection + redditPainSocialSection + tiktokPerfSocialSection + takenKeysBlock + socialDedup + socialTail;",
)

js = js.replace(
    "return [{ json: { socialPrompt, blogPrompt, hasCtx, updatedAt, recentTopics, publishedTitles, redditPainSummary } }];",
    "return [{ json: { socialPrompt, blogPrompt, hasCtx, updatedAt, recentTopics, publishedTitles, redditPainSummary, tiktokPerfSummary } }];",
)

nodes['Extract context']['parameters']['jsCode'] = js

json.dump(raw if is_list else wf, open(OUT, 'w'), indent=1, ensure_ascii=False)
print("written:", OUT)
print("nodes:", [n['name'] for n in wf['nodes']])
