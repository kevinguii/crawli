#!/usr/bin/env python3
"""Rewrite the daily-content-email workflow: new prompts (pillars, exec detail,
GEO/AEO, PAA, Crawli CTA), topic-dedup memory nodes. Idempotent-ish: run once.

Usage: _build_daily_email.py [INPUT_PATH] [OUTPUT_PATH]
Defaults to the repo definition for both."""
import json, copy, os, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "docs/workflows/daily-content-email.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else PATH
SUPA = "https://peyqxfijdrziqfjkxjsn.supabase.co"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # service_role: never hardcode

# ---------------------------------------------------------------- Extract context jsCode
EXTRACT_JS = r'''// ---- SEO context (may be empty on first run) ----
const seoRows = $('Fetch SEO context').all();
let contextBlock = '';
let updatedAt = '';
if (seoRows.length > 0 && seoRows[0].json) {
  const kj = seoRows[0].json.keywords_json;
  if (kj && kj.dailyContext) {
    contextBlock = String(kj.dailyContext);
    updatedAt = seoRows[0].json.updated_at || '';
  }
}
const hasCtx = contextBlock.length > 0;

// ---- Recent topics for dedup (fetched inline; a separate node would break the
// chain when content_history is empty, since 0 items stops downstream nodes) ----
const SUPA_KEY = '__SUPA_KEY__';
let recentRows = [];
try {
  const resp = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://peyqxfijdrziqfjkxjsn.supabase.co/rest/v1/content_history?select=title,kind&order=created_at.desc&limit=80',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    json: true,
  });
  if (Array.isArray(resp)) recentRows = resp;
} catch (e) { recentRows = []; }
const recentSocial = [];
const recentBlog = [];
for (const j of recentRows) {
  if (!j || !j.title) continue;
  if (j.kind === 'blog') recentBlog.push(String(j.title));
  else recentSocial.push(String(j.title));
}
const socialDedup = recentSocial.length
  ? '\n\nAlready covered recently - do NOT repeat or closely echo these social topics. Pick genuinely fresh angles:\n' + recentSocial.slice(0, 30).map(t => '- ' + t).join('\n')
  : '';
const blogDedup = recentBlog.length
  ? '\n\nAlready covered recently - do NOT repeat or closely echo these blog topics or their keywords. Pick genuinely fresh angles:\n' + recentBlog.slice(0, 30).map(t => '- ' + t).join('\n')
  : '';

// ---- SEO keyword injection ----
const socialSeoSection = hasCtx
  ? '\n\nSEO keyword context this week (use for 3-4 of the 10 ideas when the angle is genuine):\n' + contextBlock + '\n\nOnly weave a keyword in when it leads to a specific, useful idea. Do not force keywords into weak ideas.'
  : '';
const blogSeoSection = hasCtx
  ? "\n\nThis week's SEO keyword priorities (from Monday's research):\n" + contextBlock + '\n\nLean toward these for 2-3 of the 4 briefs. Pick the ones with the strongest angle, not just because they are on the list.'
  : '';

// ============================ SOCIAL PROMPT ============================
const socialIntro = `You write content ideas for Crawli, a free tool that searches secondhand fashion marketplaces (Depop, Poshmark, Vestiaire Collective, eBay, ThredUp, The RealReal) at once. The person behind the account genuinely shops and sells secondhand.

Generate 10 content ideas, ranked 1 (best) to 10. Each works as both an Instagram post and a TikTok.

MOST IMPORTANT RULE: these are broadly useful tips, stories, how-tos, and guides that ANY follower can find valuable. They are NOT one-off personal finds. Never write an idea that depends on a specific item the creator happened to buy (no "I found this exact Prada bag for 400"). Think the way a strong "5 things every reseller gets wrong" or "how to actually find good vintage tees" post works: advice and stories that apply to many people, where the final slide is a soft tie to Crawli. A specific price or item may appear only as an example inside a broader lesson, never as the whole post.

Pull from these content pillars and vary across the 10:
- tips / lists: practical edges most people miss (sourcing, sizing, spotting fakes, negotiating, shipping)
- how-to / workflow: step-by-step methods, including reseller workflows (where to research, where to list, how to track and reprice)
- myth-busting / POV: a contrarian take backed by reasoning (buying luxury new is mostly a markup, etc)
- story / educational: how a platform actually works, what trips people up, small worked examples
- item-hunt guides: how to find a TYPE of thing (good band tees, real leather boots, a specific era of denim), not a single item
- trend: tie to something real happening in fashion right now

Three audience segments, label each idea:
- fashionistas: brand-conscious, smart luxury buys, aspirational but careful with money
- vintage community: the hunt, slow fashion, character over newness
- resellers: profit-focused, want practical sourcing and pricing edges`;

const socialTail = `

Every idea must include enough detail to actually make the post:
- slides: a slide-by-slide breakdown. Each entry is one short line describing what is on that slide (the on-screen text or the point). Carousels 5 to 8 slides, reels 4 to 6 beats, single image or text post 1 to 3.
- visual_direction: one sentence on what to film, photograph, or show.
- cta_slide: the final slide. Lead with a genuinely useful closing line, then ONE plain sentence pointing to Crawli. Example: "checking every site one by one is the slow part. crawli searches all of them at once at thecrawli.com". Soft bridge first, one CTA line, never pushy.

Tone rules, CRITICAL, enforced:
- NO exclamation marks anywhere. A period ends a sentence.
- NO em dashes. Use a comma or restructure.
- NO marketing language: not "game-changing", not "discover", not "curated", not "ultimate", not "amazing finds".
- NO hype openers: not "Check out", not "You won't believe", not "Omg".
- Sound like a real person who buys secondhand, not a brand performing enthusiasm.
- Lead with the specific useful thing, not a setup.

WRONG ig_hook: "You won't believe these 5 reseller secrets"
RIGHT ig_hook: "most resellers lose money on shipping before they ever sell a thing. here is the fix."
WRONG tiktok_hook: "Here is how to spot a fake designer bag"
RIGHT tiktok_hook: "the stitching on a real LV bag is always slightly uneven. here is the first thing to check."

Return only a JSON array of exactly 10 objects, no markdown, no explanation:
[{"rank":1,"format":"carousel|reel|single image|text post","segment":"fashionistas|vintage community|resellers|all","pillar":"tips|how-to|myth-busting|story|item-hunt|trend","title":"short internal label for this post","caption_angle":"1-2 sentences, the actual point of the post","ig_hook":"opening line of the IG caption, specific and real, no hype","tiktok_hook":"first thing said or shown, lands in 2 seconds","slide_count":6,"slides":["slide 1 text","slide 2 text","slide 3 text"],"visual_direction":"one sentence on what to film or show","cta_slide":"final slide: a useful closing line then one soft Crawli CTA sentence","hashtag_direction":"3-5 words describing the hashtag territory","tiktok_format":"one sentence on the video style"}]`;

const socialPrompt = socialIntro + socialSeoSection + socialDedup + socialTail;

// ============================ BLOG PROMPT ============================
const blogIntro = `You write SEO and AEO content briefs for Crawli's blog. Crawli is a free tool that searches secondhand fashion marketplaces (Depop, Poshmark, Vestiaire Collective, eBay, ThredUp, The RealReal) at once. Readers shop or sell secondhand: bargain hunters, resellers, luxury buyers going preloved, vintage fans.

Generate 4 blog post briefs. Specific, opinionated, grounded, written like someone who has used these platforms for years. Not generic beginner guides.

These briefs are built to get cited by AI answer engines (ChatGPT, Perplexity, Google AI Overviews), not only to rank on Google. More and more people ask an AI instead of searching, so being the source an AI quotes matters as much as ranking. That changes what each brief must contain:
- direct_answer: a 1 to 2 sentence, definition-style answer to the question the title implies, written to sit at the very top of the post. AI engines extract this as the canonical answer.
- key_stat: one specific, citable statistic with its real source named. Do NOT invent precise figures and do NOT attribute made-up numbers to real companies. If you are not certain of the exact number, give an approximate range, name the source the writer should check, and end the stat with "(verify)". Stats with named sources are the single biggest driver of AI citations, but one fabricated stat destroys trust, so flag anything you are not certain of.
- structure_element: one comparison table or numbered list the post must include. Pages with a table or numbered list are far more likely to be cited.
- people_also_ask: 4 to 6 real questions people actually ask on this topic, the kind that show up in Google's People Also Ask box. The post answers each in a short, direct, extractable question-and-answer block. This wins both the PAA box and AI answers.

Content pillars, vary across the 4 and lean toward ones not covered recently:
- best sites to buy or sell a given thing (best places to sell sneakers, where to buy real vintage Levis)
- reseller workflows (research on one tool, list on another, track everything in Crawli)
- item guides (how to find a TYPE of item: good band tees, authentic designer bags, winter coats under 100)
- case studies and worked examples (walk through a realistic scenario with numbers)
- platform deep-dives (how authentication actually works, fees, quirks, what gets flagged)
- opinion / POV (a contrarian, defensible take)`;

const blogTail = `

crawli_angle: end every post with a soft bridge plus ONE explicit CTA sentence. The bridge connects the post topic to Crawli naturally, the CTA is one plain line. Example: "you can search all of these at once instead of going tab by tab, for free, at thecrawli.com". Genuine information first, one CTA line at the end, no banner language.

Tone rules, CRITICAL:
- NO exclamation marks. NO em dashes.
- NO listicle-cliche titles ("10 ways to", "The ultimate guide to").
- NO preamble hooks ("Navigating the world of", "In today's world", "Whether you are a beginner or expert").
- hook_sentence opens with the specific interesting thing: a fact, a take, a counterintuitive observation.
- Angles are opinionated or counterintuitive, not "comprehensive".

WRONG title: "How to effectively sell on Depop for beginners"
RIGHT title: "Why your Depop listings are not selling, and it is probably not the price"
WRONG hook: "Navigating secondhand luxury can be daunting without the right tools."
RIGHT hook: "Vestiaire Collective rejects roughly 30% of items submitted for authentication. Here is what actually gets flagged."

Return only a JSON array of exactly 4 objects, no markdown, no explanation:
[{"title":"direct, specific, not a how-to","angle":"1 sentence, the opinionated or counterintuitive point","audience":"who specifically this is for","pillar":"best-sites|reseller-workflow|item-guide|case-study|platform-deepdive|opinion","primary_keyword":"main search query to rank for","secondary_keywords":["3-4 related terms"],"direct_answer":"1-2 sentence definition-style answer for the top of the post","hook_sentence":"opening sentence, a specific fact or take, no warmup","key_stat":"one real citable statistic with its source named, end with (verify) if you are not certain of the exact number","structure_element":"the table or numbered list the post must include, described in one line","supporting_points":["4 concrete things the post must cover"],"people_also_ask":["question 1","question 2","question 3","question 4"],"crawli_angle":"soft bridge plus one explicit Crawli CTA sentence for the end","x_post":"1-3 sentences, same take, personal, no exclamation marks, no em dashes"}]`;

const blogPrompt = blogIntro + blogSeoSection + blogDedup + blogTail;

return [{ json: { socialPrompt, blogPrompt, hasCtx, updatedAt } }];
'''

# ---------------------------------------------------------------- Build email jsCode
BUILD_JS = r'''// Parse social ideas
let socialText = $('Generate social ideas').first().json.output[0].content[0].text.trim();
socialText = socialText.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
let socialIdeas = [];
try { socialIdeas = JSON.parse(socialText); } catch(e) { socialIdeas = []; }

// Parse blog briefs
let blogText = $('Generate blog briefs').first().json.output[0].content[0].text.trim();
blogText = blogText.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
let blogBriefs = [];
try { blogBriefs = JSON.parse(blogText); } catch(e) { blogBriefs = []; }

const sanitize = (s) => String(s||'')
  .replace(/!+/g, '.')
  .replace(/—/g, ',')
  .replace(/ – /g, ', ')
  .replace(/\.{2,}/g, '.')
  .replace(/,\s*,/g, ',')
  .trim();

const sanitizeObj = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = sanitize(v);
    else if (Array.isArray(v)) out[k] = v.map(x => typeof x === 'string' ? sanitize(x) : x);
    else out[k] = v;
  }
  return out;
};

socialIdeas = socialIdeas.map(sanitizeObj);
blogBriefs = blogBriefs.map(sanitizeObj);

const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const today = new Date().toISOString().slice(0,10);

// SEO context badge
const hasCtx = $('Extract context').first().json.hasCtx;
const ctxUpdatedAt = $('Extract context').first().json.updatedAt || '';
const ctxBadge = hasCtx
  ? `<p style="margin:0 0 24px;font-size:12px;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:6px 10px;border-radius:4px;display:inline-block">SEO keyword context active, updated ${esc(ctxUpdatedAt.slice(0,10))}</p>`
  : `<p style="margin:0 0 24px;font-size:12px;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;padding:6px 10px;border-radius:4px;display:inline-block">No SEO context yet, run the weekly brief on Monday to activate</p>`;

const fmtColor = (f) => ({
  'carousel':'#5B6CF9','reel':'#DC2626','reel concept':'#DC2626','single image':'#059669','text post':'#D97706'
})[f] || '#6B7280';

const segEmoji = (s) => ({
  'fashionistas':'✨','vintage community':'🧶','resellers':'💰','all':'👥'
})[s] || '';

socialIdeas.sort((a,b)=>a.rank-b.rank);
let socialHtml = `<h2 style="margin-bottom:6px;font-size:18px;color:#111">Social content ideas</h2>
<p style="color:#6B7280;margin-top:0;margin-bottom:20px;font-size:14px">10 ideas, broadly useful tips and stories. IG + TikTok versions. You post manually.</p>`;

if (!socialIdeas.length) {
  socialHtml += '<p>No ideas generated.</p>';
} else {
  socialHtml += socialIdeas.map(idea => {
    const col = fmtColor(idea.format);
    const slides = Array.isArray(idea.slides) ? idea.slides : [];
    const slidesHtml = slides.length
      ? `<p style="margin:8px 0 3px;font-size:13px"><strong>Slides (${idea.slide_count || slides.length}):</strong></p><ol style="margin:0 0 8px;padding-left:18px;font-size:13px">${slides.map(s=>`<li style="margin-bottom:2px">${esc(s)}</li>`).join('')}</ol>`
      : '';
    return `<div style="margin-bottom:18px;padding:14px;border:1px solid #e5e7eb;border-radius:8px">
  <p style="margin:0 0 8px">
    <span style="background:${col};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">${esc(idea.format)}</span>
    <span style="margin-left:8px;color:#6B7280;font-size:12px">${segEmoji(idea.segment)} ${esc(idea.segment)}</span>
    ${idea.pillar ? `<span style="margin-left:8px;color:#9CA3AF;font-size:11px">${esc(idea.pillar)}</span>` : ''}
  </p>
  <p style="margin:0 0 5px"><strong>Angle:</strong> ${esc(idea.caption_angle)}</p>
  <p style="margin:0 0 5px"><strong>IG opening line:</strong> ${esc(idea.ig_hook)}</p>
  ${slidesHtml}
  ${idea.visual_direction ? `<p style="margin:0 0 5px;font-size:13px"><strong>Visuals:</strong> ${esc(idea.visual_direction)}</p>` : ''}
  ${idea.cta_slide ? `<p style="margin:0 0 8px;font-size:13px;color:#5B6CF9"><strong>Final slide / CTA:</strong> ${esc(idea.cta_slide)}</p>` : ''}
  <p style="margin:0 0 8px;font-size:12px;color:#6B7280"><strong>Hashtag territory:</strong> ${esc(idea.hashtag_direction)}</p>
  <div style="background:#fafafa;padding:10px;border-radius:6px">
    <p style="margin:0 0 4px;font-size:13px"><strong style="color:#DC2626">TikTok hook:</strong> ${esc(idea.tiktok_hook)}</p>
    <p style="margin:0;font-size:13px;color:#6B7280">${esc(idea.tiktok_format)}</p>
  </div>
</div>`;
  }).join('');
}

let blogHtml = `<h2 style="margin-bottom:6px;font-size:18px;color:#111">Blog briefs</h2>
<p style="color:#6B7280;margin-top:0;margin-bottom:20px;font-size:14px">4 briefs built to rank on Google and get cited by AI. You write the full post.</p>`;

if (!blogBriefs.length) {
  blogHtml += '<p>No briefs generated.</p>';
} else {
  blogHtml += blogBriefs.map((brief,i) => {
    const paa = Array.isArray(brief.people_also_ask) ? brief.people_also_ask : [];
    const paaHtml = paa.length
      ? `<p style="margin:8px 0 3px;font-size:13px"><strong>People Also Ask (answer each as a short Q&amp;A, becomes the FAQ):</strong></p><ul style="margin:0 0 8px;padding-left:18px;font-size:13px">${paa.map(q=>`<li style="margin-bottom:2px">${esc(q)}</li>`).join('')}</ul>`
      : '';
    return `<div style="margin-bottom:22px;padding:14px;border:1px solid #e5e7eb;border-radius:8px">
  <h3 style="margin:0 0 3px;font-size:15px">${i+1}. ${esc(brief.title)}</h3>
  <p style="margin:0 0 8px;color:#6B7280;font-size:13px">${esc(brief.audience)}${brief.pillar ? ` &middot; ${esc(brief.pillar)}` : ''}</p>
  <p style="margin:0 0 5px"><strong>Angle:</strong> ${esc(brief.angle)}</p>
  ${brief.direct_answer ? `<div style="background:#f0fdf4;padding:9px;border-radius:6px;border-left:3px solid #16a34a;margin:0 0 8px"><p style="margin:0;font-size:13px"><strong>Direct answer (put at very top, for AI):</strong> ${esc(brief.direct_answer)}</p></div>` : ''}
  <p style="margin:0 0 5px"><strong>Primary keyword:</strong> <code style="background:#f3f4f6;padding:1px 5px;border-radius:3px">${esc(brief.primary_keyword)}</code></p>
  <p style="margin:0 0 5px"><strong>Also target:</strong> ${(brief.secondary_keywords||[]).map(k=>`<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;margin-right:4px">${esc(k)}</code>`).join(' ')}</p>
  <p style="margin:0 0 5px"><strong>Hook:</strong> ${esc(brief.hook_sentence)}</p>
  ${brief.key_stat ? `<p style="margin:0 0 5px;font-size:13px"><strong>Cite this stat:</strong> ${esc(brief.key_stat)}</p>` : ''}
  ${brief.structure_element ? `<p style="margin:0 0 5px;font-size:13px"><strong>Must include:</strong> ${esc(brief.structure_element)}</p>` : ''}
  <p style="margin:6px 0 3px"><strong>Outline:</strong></p>
  <ul style="margin:0 0 8px;padding-left:18px">${(brief.supporting_points||[]).map(p=>`<li style="margin-bottom:3px">${esc(p)}</li>`).join('')}</ul>
  ${paaHtml}
  ${brief.crawli_angle ? `<div style="background:#eef2ff;padding:9px;border-radius:6px;border-left:3px solid #5B6CF9;margin:0 0 8px"><p style="margin:0;font-size:13px"><strong>Crawli tie-in + CTA (end of post):</strong> ${esc(brief.crawli_angle)}</p></div>` : ''}
  <div style="background:#eff6ff;padding:10px;border-radius:6px;border-left:3px solid #3b82f6">
    <p style="margin:0;font-size:13px"><strong>X post:</strong> ${esc(brief.x_post)}</p>
  </div>
</div>`;
  }).join('');
}

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin-bottom:4px">Crawli content brief, ${today}</h1>
  <p style="color:#6B7280;margin-top:0;margin-bottom:12px">Daily ideas for Instagram, TikTok, and blog. Everything is a draft, post what feels right.</p>
  ${ctxBadge}
  ${socialHtml}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
  ${blogHtml}
</body></html>`;

// Topics to log for dedup (next runs avoid repeating these)
const newTopics = [];
for (const idea of socialIdeas) {
  const t = idea.title || idea.caption_angle;
  if (t) newTopics.push({ kind: 'social', title: String(t).slice(0, 200) });
}
for (const brief of blogBriefs) {
  if (brief.title) newTopics.push({ kind: 'blog', title: String(brief.title).slice(0, 200) });
}

return [{ json: { html, subject: `Crawli content brief, ${today}`, newTopics } }];
'''

# ---------------------------------------------------------------- load + mutate
raw = json.load(open(PATH))
# n8n CLI export wraps the workflow in a list; the repo definition is a bare object.
is_list = isinstance(raw, list)
wf = raw[0] if is_list else raw
nodes = {n['name']: n for n in wf['nodes']}

nodes['Extract context']['parameters']['jsCode'] = EXTRACT_JS.replace('__SUPA_KEY__', KEY)
nodes['Build email']['parameters']['jsCode'] = BUILD_JS

hdrs = [
    {"name": "apikey", "value": KEY},
    {"name": "Authorization", "value": "Bearer " + KEY},
]

save_topics = {
    "parameters": {
        "method": "POST",
        "url": SUPA + "/rest/v1/content_history",
        "sendHeaders": True,
        "headerParameters": {"parameters": list(hdrs) + [
            {"name": "Content-Type", "value": "application/json"},
            {"name": "Prefer", "value": "return=minimal"},
        ]},
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($('Build email').first().json.newTopics) }}",
        "options": {},
    },
    "id": "node-save-topics",
    "name": "Save topics",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.4,
    "position": [1680, 300],
    "onError": "continueRegularOutput",
}

# avoid duplicate inserts if re-run; drop the old fetch node if a prior version added it
wf['nodes'] = [n for n in wf['nodes'] if n['name'] not in ('Fetch recent topics', 'Save topics')]
wf['nodes'].append(save_topics)

# rewire connections: recent-topics fetch now happens inside Extract context
c = wf['connections']
c['Fetch SEO context'] = {"main": [[{"node": "Extract context", "type": "main", "index": 0}]]}
c.pop('Fetch recent topics', None)
c['Send email'] = {"main": [[{"node": "Save topics", "type": "main", "index": 0}]]}

json.dump(raw if is_list else wf, open(OUT, 'w'), indent=1, ensure_ascii=False)
print("written:", OUT)
print("nodes:", [n['name'] for n in wf['nodes']])
