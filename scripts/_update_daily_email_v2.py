#!/usr/bin/env python3
"""Patch the daily-content-email workflow (v2): broaden the content taxonomy with
educational/informational pillars (fashion history, makers, materials, culture,
eras, people, news) and add a real topic-dedup layer (topic_key + code-side
similarity flagging) to BOTH the social and blog prompts.

This OPERATES ON the current source-of-truth JSON rather than rebuilding from
scratch, so it preserves the live features that were added on the server but
never back-ported to scripts/_build_daily_email.py (15 social / 10 blog counts,
content_history limit=100, the published_posts hard-dedup, the Tue+Fri schedule).
scripts/_build_daily_email.py is stale and must NOT be re-run; this v2 patch is
the canonical generator now.

Idempotent: only replaces the two Code-node bodies + the Save topics insert body.

Usage: _update_daily_email_v2.py [INPUT_PATH] [OUTPUT_PATH]
Defaults to the repo definition for both.
Prerequisite before deploy: content_history + published_posts need a topic_key
column (see scripts/_migrations_topic_key.sql)."""
import json, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "docs/workflows/daily-content-email.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else PATH
SUPA = "https://peyqxfijdrziqfjkxjsn.supabase.co"
KEY = ("REDACTED_JWT"
       "InBleXF4ZmlqZHJ6aXFmamt4anNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6"
       "MTc3ODcxODQxMSwiZXhwIjoyMDk0Mjk0NDExfQ.T-tzO0pJBanVwp-Kd4MvnXA8GXll4xV88I0NosMQY1Y")

# ============================================================ Extract context
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
    url: 'https://peyqxfijdrziqfjkxjsn.supabase.co/rest/v1/content_history?select=title,kind,topic_key&order=created_at.desc&limit=100',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    json: true,
  });
  if (Array.isArray(resp)) recentRows = resp;
} catch (e) { recentRows = []; }
const recentSocial = [];
const recentBlog = [];
const recentTopics = [];   // full rows forwarded to Build email for similarity flagging
const takenKeys = [];      // distinct topic_keys already used (controlled vocab signal)
const seenKey = {};
for (const j of recentRows) {
  if (!j || !j.title) continue;
  const tk = j.topic_key ? String(j.topic_key) : '';
  recentTopics.push({ kind: j.kind === 'blog' ? 'blog' : 'social', title: String(j.title), topic_key: tk });
  if (j.kind === 'blog') recentBlog.push(String(j.title));
  else recentSocial.push(String(j.title));
  if (tk && !seenKey[tk]) { seenKey[tk] = 1; takenKeys.push(tk); }
}
const socialDedup = recentSocial.length
  ? '\n\nAlready covered recently - do NOT repeat or closely echo these social topics. Pick genuinely fresh angles:\n' + recentSocial.slice(0, 40).map(t => '- ' + t).join('\n')
  : '';
const blogDedup = recentBlog.length
  ? '\n\nAlready covered recently - do NOT repeat or closely echo these blog topics or their keywords. Pick genuinely fresh angles:\n' + recentBlog.slice(0, 40).map(t => '- ' + t).join('\n')
  : '';
const takenKeysBlock = takenKeys.length
  ? '\n\nThese topic_key values are already used up. The subject behind each is taken, so do NOT reuse the key and do NOT cover the same subject under a new name:\n' + takenKeys.slice(0, 60).map(k => '- ' + k).join('\n')
  : '';

// ---- Published blog posts (hard dedup - never re-suggest a topic we have already written and published) ----
let publishedRows = [];
try {
  const resp2 = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://peyqxfijdrziqfjkxjsn.supabase.co/rest/v1/published_posts?select=title&order=created_at.desc',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    json: true,
  });
  if (Array.isArray(resp2)) publishedRows = resp2;
} catch (e) { publishedRows = []; }
const publishedTitles = publishedRows.map(r => String(r.title || '')).filter(Boolean);
const blogPublishedDedup = publishedTitles.length
  ? '\n\nALREADY PUBLISHED - these posts are live on the Crawli blog. Do NOT generate a brief covering the same topic, angle, or primary keyword. Pick genuinely different subjects:\n' + publishedTitles.map(t => '- ' + t).join('\n')
  : '';

// ---- SEO keyword injection ----
const socialSeoSection = hasCtx
  ? '\n\nSEO keyword context this week (use for 4-5 of the 15 ideas when the angle is genuine):\n' + contextBlock + '\n\nOnly weave a keyword in when it leads to a specific, useful idea. Do not force keywords into weak ideas.'
  : '';
const blogSeoSection = hasCtx
  ? "\n\nThis week's SEO keyword priorities (from Monday's research):\n" + contextBlock + '\n\nLean toward these for 4-6 of the 10 briefs. Pick the ones with the strongest angle, not just because they are on the list.'
  : '';

// ============================ SOCIAL PROMPT ============================
const socialIntro = `You write content ideas for Crawli, a free tool that searches secondhand fashion marketplaces (Depop, Poshmark, Vestiaire Collective, eBay, ThredUp, The RealReal) at once. The person behind the account genuinely shops and sells secondhand.

Generate 15 content ideas, ranked 1 (best) to 15. Each works as both an Instagram post and a TikTok.

MOST IMPORTANT RULE: these are broadly useful posts that ANY follower can find valuable. They are NOT one-off personal finds. Never write an idea that depends on a specific item the creator happened to buy (no "I found this exact Prada bag for 400"). A specific price or item may appear only as an example inside a broader lesson, never as the whole post.

SECOND RULE, JUST AS IMPORTANT: operational how-to and tips ("how to price", "how to spot fakes", "how to optimise your Depop") are already heavily covered and keep repeating. At least HALF of the 15 ideas MUST be educational or story-driven: they teach the follower something about clothing itself, its history, its makers, its materials, or the culture around it, not just how to buy or sell. Treat the educational pillars below as the default and the operational ones as the minority.

Content pillars. Use the OPERATIONAL group for at most half the ideas; lean on the EDUCATIONAL group for the rest.

OPERATIONAL (at most ~7 of 15):
- tips / lists: practical edges most people miss (sourcing, sizing, negotiating, shipping)
- how-to / workflow: step-by-step methods, including reseller workflows (research, list, track, reprice)
- myth-busting / POV: a contrarian take backed by reasoning
- item-hunt: how to find a TYPE of thing (good band tees, real leather boots, an era of denim)

EDUCATIONAL AND STORY (aim for ~8 of 15, these are underused and have huge range):
- fashion-history: how a garment, style, or trend came to be (origin of the trench coat, why Levi's 501s have rivets, how band tees became collectible, workwear becoming everyday fashion, the industrial revolution and ready-to-wear)
- maker-and-craft: designers, houses, and construction (who shaped a label, what selvedge denim is, Goodyear welt vs glued soles, what makes a garment well made)
- culture-and-scene: a subculture or scene explained (Japanese denim culture, Ivy and prep, archive fashion, gorpcore, Americana vs European vintage)
- material-and-construction: fabrics, leather, hardware, dyes, and how to read what a piece is actually made of
- era-guide: decade by decade, what defined the look and how to date a piece by its tags, fonts, and cuts
- people-and-stories: a profile, short interview style, or success story of a reseller, dealer, or collector and what they did differently
- trend-and-news: something real happening in fashion or resale right now

Vary across the 15 so no two ideas share a subject, and spread across all three audience segments.

topic_key rule: every idea carries a topic_key, a 2 to 4 word lowercase hyphenated slug naming the core SUBJECT, not the framing or format. The same subject always gets the same key. Examples: japanese-denim, trench-coat-history, selvedge-construction, vintage-sizing, depop-profile, spotting-fakes. If a subject already appears in the recent topics or the taken topic_key list above, it is used up, so pick a genuinely different subject and a different key.

Three audience segments, label each idea:
- fashionistas: brand-conscious, smart luxury buys, aspirational but careful with money
- vintage community: the hunt, slow fashion, character over newness
- resellers: profit-focused, want practical sourcing and pricing edges`;

const socialTail = `

Every idea must include enough detail to actually make the post:
- slides: a slide-by-slide breakdown. Each entry is one short line describing what is on that slide (the on-screen text or the point). Carousels 5 to 8 slides, reels 4 to 6 beats, single image or text post 1 to 3.
- visual_direction: one sentence on what to film, photograph, or show.
- cta_slide: the final slide. Lead with a genuinely useful closing line, then ONE plain sentence pointing to Crawli. Example: "checking every site one by one is the slow part. crawli searches all of them at once at thecrawli.com". Soft bridge first, one CTA line, never pushy. Educational posts still close on Crawli, just bridge from the lesson (e.g. "once you know the era you want, crawli finds it across every platform at thecrawli.com").

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

Return only a JSON array of exactly 15 objects, no markdown, no explanation:
[{"rank":1,"format":"carousel|reel|single image|text post","segment":"fashionistas|vintage community|resellers|all","pillar":"tips|how-to|myth-busting|item-hunt|fashion-history|maker-and-craft|culture-and-scene|material-and-construction|era-guide|people-and-stories|trend-and-news","topic_key":"2-4 word lowercase hyphenated subject slug","title":"short internal label for this post","caption_angle":"1-2 sentences, the actual point of the post","ig_hook":"opening line of the IG caption, specific and real, no hype","tiktok_hook":"first thing said or shown, lands in 2 seconds","slide_count":6,"slides":["slide 1 text","slide 2 text","slide 3 text"],"visual_direction":"one sentence on what to film or show","cta_slide":"final slide: a useful closing line then one soft Crawli CTA sentence","hashtag_direction":"3-5 words describing the hashtag territory","tiktok_format":"one sentence on the video style"}]`;

const socialPrompt = socialIntro + socialSeoSection + takenKeysBlock + socialDedup + socialTail;

// ============================ BLOG PROMPT ============================
const blogIntro = `You write SEO and AEO content briefs for Crawli's blog. Crawli is a free tool that searches secondhand fashion marketplaces (Depop, Poshmark, Vestiaire Collective, eBay, ThredUp, The RealReal) at once. Readers shop or sell secondhand: bargain hunters, resellers, luxury buyers going preloved, vintage fans.

Generate 10 blog post briefs. Specific, opinionated, grounded, written like someone who has used these platforms and known these clothes for years. Not generic beginner guides.

IMPORTANT: operational and best-sites posts ("how to price", "best places to sell", "how to optimise your profile") are already heavily covered and keep repeating. At least HALF of the 10 briefs MUST be educational or explainer pieces about clothing itself: its history, its makers, its materials, the culture around it. These rank for evergreen informational queries and get cited by AI answer engines, and they are where we have the most untapped room.

These briefs are built to get cited by AI answer engines (ChatGPT, Perplexity, Google AI Overviews), not only to rank on Google. That changes what each brief must contain:
- direct_answer: a 1 to 2 sentence, definition-style answer to the question the title implies, written to sit at the very top of the post. AI engines extract this as the canonical answer.
- key_stat: one specific, citable statistic with its real source named. Do NOT invent precise figures and do NOT attribute made-up numbers to real companies. If you are not certain of the exact number, give an approximate range, name the source the writer should check, and end the stat with "(verify)". Stats with named sources are the single biggest driver of AI citations, but one fabricated stat destroys trust, so flag anything you are not certain of.
- structure_element: one comparison table or numbered list the post must include. Pages with a table or numbered list are far more likely to be cited.
- people_also_ask: 4 to 6 real questions people actually ask on this topic, the kind that show up in Google's People Also Ask box. The post answers each in a short, direct, extractable question-and-answer block.

Content pillars. Use the OPERATIONAL group for at most half the briefs; lean on the EDUCATIONAL group for the rest.

OPERATIONAL (at most ~5 of 10):
- best-sites: best sites to buy or sell a given thing
- reseller-workflow: research on one tool, list on another, track in Crawli
- item-guide: how to find a TYPE of item (good band tees, authentic designer bags, winter coats under 100)
- case-study: a realistic worked example with numbers
- platform-deepdive: how authentication, fees, or flagging actually works
- opinion: a contrarian, defensible take

EDUCATIONAL AND EXPLAINER (aim for ~5 of 10, large untapped range):
- fashion-history: the origin story of a garment, brand, or trend (the trench coat, the Breton stripe, the band tee, denim itself)
- maker-deep-dive: a designer, house, or craft tradition explained for buyers
- material-guide: a fabric, leather, hardware, or construction method explained so a buyer can judge quality
- culture-explainer: a scene or movement (Japanese denim, archive fashion, prep, workwear, gorpcore)
- era-guide: how to date and understand a decade of clothing
- category-deep-guide: a thorough buyer's education on one category (selvedge jeans, leather jackets, wool overcoats, mechanical-era band tees)

topic_key rule: every brief carries a topic_key, a 2 to 4 word lowercase hyphenated slug naming the core SUBJECT, not the framing. The same subject always gets the same key. Examples: japanese-denim, trench-coat-history, vestiaire-authentication, selvedge-jeans-guide. If a subject already appears in the recent topics, the taken topic_key list, or the already-published list above, it is used up, so pick a genuinely different subject and key.`;

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

Return only a JSON array of exactly 10 objects, no markdown, no explanation:
[{"title":"direct, specific, not a how-to","angle":"1 sentence, the opinionated or counterintuitive point","audience":"who specifically this is for","pillar":"best-sites|reseller-workflow|item-guide|case-study|platform-deepdive|opinion|fashion-history|maker-deep-dive|material-guide|culture-explainer|era-guide|category-deep-guide","topic_key":"2-4 word lowercase hyphenated subject slug","primary_keyword":"main search query to rank for","secondary_keywords":["3-4 related terms"],"direct_answer":"1-2 sentence definition-style answer for the top of the post","hook_sentence":"opening sentence, a specific fact or take, no warmup","key_stat":"one real citable statistic with its source named, end with (verify) if you are not certain of the exact number","structure_element":"the table or numbered list the post must include, described in one line","supporting_points":["4 concrete things the post must cover"],"people_also_ask":["question 1","question 2","question 3","question 4"],"crawli_angle":"soft bridge plus one explicit Crawli CTA sentence for the end","x_post":"1-3 sentences, same take, personal, no exclamation marks, no em dashes"}]`;

const blogPrompt = blogIntro + blogSeoSection + blogPublishedDedup + takenKeysBlock + blogDedup + blogTail;

return [{ json: { socialPrompt, blogPrompt, hasCtx, updatedAt, recentTopics, publishedTitles } }];
'''

# ============================================================ Build email
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

// ===================== DEDUP DETECTION (flag likely repeats) =====================
// Recent history (content_history) + published blog titles, forwarded by Extract context.
const recentTopics = $('Extract context').first().json.recentTopics || [];
const publishedTitles = $('Extract context').first().json.publishedTitles || [];
const recentSocialT = recentTopics.filter(r => r.kind !== 'blog');
const recentBlogT = recentTopics.filter(r => r.kind === 'blog')
  .concat(publishedTitles.map(t => ({ kind: 'blog', title: t, topic_key: '' })));

// Generic words stripped before measuring title overlap, so two unrelated posts
// do not look similar just because both say "vintage" or "secondhand".
const STOP = new Set(('the a an of for to and or in on at by with your you it its this that as is are be how why what when where which who do does your top best ways way tips tricks guide secondhand vintage fashion resale reseller clothes clothing item items piece pieces style styles buy buying sell selling shop shopping online store stores').split(' '));
const toks = (s) => { const set = new Set(); for (const w of String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/)) { if (w.length > 2 && !STOP.has(w)) set.add(w); } return set; };
const jac = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let inter = 0; for (const x of A) if (B.has(x)) inter++; return inter / (A.size + B.size - inter); };
const normKey = (s) => String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const SIM = 0.5; // title-overlap threshold for "likely repeat"

// item = the new idea/brief; history = prior list; batchSoFar = already-accepted items this run
function dupCheck(item, history, batchSoFar) {
  const key = normKey(item.topic_key);
  const text = [item.title, item.caption_angle, item.angle, item.primary_keyword].filter(Boolean).join(' ');
  for (const r of history) {
    if (key && r.topic_key && normKey(r.topic_key) === key) return { dupe: true, why: 'same topic as a recent or published post (' + esc(r.title) + ')' };
  }
  for (const r of batchSoFar) {
    if (key && normKey(r.topic_key) === key) return { dupe: true, why: 'repeats another idea in this batch (' + esc(r.title) + ')' };
  }
  // canonical topic_key contained in a prior title: catches verbose new titles vs
  // short history, and history rows that have no topic_key (e.g. published_posts).
  const keyToks = toks(String(item.topic_key||'').replace(/-/g,' '));
  if (keyToks.size >= 2) {
    const contained = (title) => { const T = toks(title); let inter = 0; for (const x of keyToks) if (T.has(x)) inter++; return inter / keyToks.size; };
    for (const r of history) { if (contained(r.title) >= 0.67) return { dupe: true, why: 'topic matches an earlier post (' + esc(r.title) + ')' }; }
    for (const r of batchSoFar) { if (contained(r.title) >= 0.67) return { dupe: true, why: 'topic matches another idea in this batch (' + esc(r.title) + ')' }; }
  }
  let best = 0, bestT = '';
  for (const r of history) { const s = jac(text, r.title); if (s > best) { best = s; bestT = r.title; } }
  for (const r of batchSoFar) { const s = jac(text, (r.title || '') + ' ' + (r.caption_angle || r.angle || '')); if (s > best) { best = s; bestT = r.title; } }
  if (best >= SIM) return { dupe: true, why: 'very similar to "' + esc(bestT) + '" (' + Math.round(best * 100) + '% word overlap)' };
  return { dupe: false };
}

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

const dupBadge = (why) => `<p style="margin:0 0 8px;font-size:12px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;padding:6px 10px;border-radius:4px">⚠ Possible repeat: ${why}. Review before using.</p>`;

// ---------------- social ----------------
socialIdeas.sort((a,b)=>(a.rank||99)-(b.rank||99));
const socialAccepted = [];
for (const idea of socialIdeas) { idea._dup = dupCheck(idea, recentSocialT, socialAccepted); socialAccepted.push(idea); }
const socialClean = socialIdeas.filter(i => !i._dup.dupe);
const socialFlagged = socialIdeas.filter(i => i._dup.dupe);
const socialOrdered = socialClean.concat(socialFlagged);

const renderIdea = (idea) => {
  const col = fmtColor(idea.format);
  const slides = Array.isArray(idea.slides) ? idea.slides : [];
  const slidesHtml = slides.length
    ? `<p style="margin:8px 0 3px;font-size:13px"><strong>Slides (${idea.slide_count || slides.length}):</strong></p><ol style="margin:0 0 8px;padding-left:18px;font-size:13px">${slides.map(s=>`<li style="margin-bottom:2px">${esc(s)}</li>`).join('')}</ol>`
    : '';
  const border = idea._dup && idea._dup.dupe ? '#fdba74' : '#e5e7eb';
  return `<div style="margin-bottom:18px;padding:14px;border:1px solid ${border};border-radius:8px">
  ${idea._dup && idea._dup.dupe ? dupBadge(idea._dup.why) : ''}
  <p style="margin:0 0 8px">
    <span style="background:${col};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">${esc(idea.format)}</span>
    <span style="margin-left:8px;color:#6B7280;font-size:12px">${segEmoji(idea.segment)} ${esc(idea.segment)}</span>
    ${idea.pillar ? `<span style="margin-left:8px;color:#9CA3AF;font-size:11px">${esc(idea.pillar)}</span>` : ''}
    ${idea.topic_key ? `<span style="margin-left:8px;color:#9CA3AF;font-size:11px">#${esc(idea.topic_key)}</span>` : ''}
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
};

let socialHtml = `<h2 style="margin-bottom:6px;font-size:18px;color:#111">Social content ideas</h2>
<p style="color:#6B7280;margin-top:0;margin-bottom:20px;font-size:14px">15 ideas, broadly useful tips and stories. IG + TikTok versions. You post manually.${socialFlagged.length ? ` <strong style="color:#9a3412">${socialFlagged.length} flagged as possible repeats (shown last).</strong>` : ''}</p>`;
if (!socialIdeas.length) {
  socialHtml += '<p>No ideas generated.</p>';
} else {
  socialHtml += socialClean.map(renderIdea).join('');
  if (socialFlagged.length) {
    socialHtml += `<p style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#9a3412">Possible repeats (review before using)</p>` + socialFlagged.map(renderIdea).join('');
  }
}

// ---------------- blog ----------------
const blogAccepted = [];
for (const brief of blogBriefs) { brief._dup = dupCheck(brief, recentBlogT, blogAccepted); blogAccepted.push(brief); }
const blogClean = blogBriefs.filter(b => !b._dup.dupe);
const blogFlagged = blogBriefs.filter(b => b._dup.dupe);

const renderBrief = (brief, i) => {
  const paa = Array.isArray(brief.people_also_ask) ? brief.people_also_ask : [];
  const paaHtml = paa.length
    ? `<p style="margin:8px 0 3px;font-size:13px"><strong>People Also Ask (answer each as a short Q&amp;A, becomes the FAQ):</strong></p><ul style="margin:0 0 8px;padding-left:18px;font-size:13px">${paa.map(q=>`<li style="margin-bottom:2px">${esc(q)}</li>`).join('')}</ul>`
    : '';
  const border = brief._dup && brief._dup.dupe ? '#fdba74' : '#e5e7eb';
  return `<div style="margin-bottom:22px;padding:14px;border:1px solid ${border};border-radius:8px">
  ${brief._dup && brief._dup.dupe ? dupBadge(brief._dup.why) : ''}
  <h3 style="margin:0 0 3px;font-size:15px">${i+1}. ${esc(brief.title)}</h3>
  <p style="margin:0 0 8px;color:#6B7280;font-size:13px">${esc(brief.audience)}${brief.pillar ? ` &middot; ${esc(brief.pillar)}` : ''}${brief.topic_key ? ` &middot; #${esc(brief.topic_key)}` : ''}</p>
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
};

let blogHtml = `<h2 style="margin-bottom:6px;font-size:18px;color:#111">Blog briefs</h2>
<p style="color:#6B7280;margin-top:0;margin-bottom:20px;font-size:14px">10 briefs built to rank on Google and get cited by AI. You write the full post.${blogFlagged.length ? ` <strong style="color:#9a3412">${blogFlagged.length} flagged as possible repeats (shown last).</strong>` : ''}</p>`;
if (!blogBriefs.length) {
  blogHtml += '<p>No briefs generated.</p>';
} else {
  let n = 0;
  blogHtml += blogClean.map((b) => renderBrief(b, n++)).join('');
  if (blogFlagged.length) {
    blogHtml += `<p style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#9a3412">Possible repeats (review before using)</p>` + blogFlagged.map((b) => renderBrief(b, n++)).join('');
  }
}

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin-bottom:4px">Crawli content brief, ${today}</h1>
  <p style="color:#6B7280;margin-top:0;margin-bottom:12px">Twice-weekly ideas for Instagram, TikTok, and blog. Everything is a draft, post what feels right.</p>
  ${ctxBadge}
  ${socialHtml}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
  ${blogHtml}
</body></html>`;

// Topics to log for dedup (next runs avoid repeating these). Includes topic_key now.
const newTopics = [];
for (const idea of socialIdeas) {
  const t = idea.title || idea.caption_angle;
  if (t) newTopics.push({ kind: 'social', title: String(t).slice(0, 200), topic_key: String(idea.topic_key||'').slice(0, 80) });
}
for (const brief of blogBriefs) {
  if (brief.title) newTopics.push({ kind: 'blog', title: String(brief.title).slice(0, 200), topic_key: String(brief.topic_key||'').slice(0, 80) });
}

return [{ json: { html, subject: `Crawli content brief, ${today}`, newTopics } }];
'''

# ============================================================ load + mutate
raw = json.load(open(PATH))
is_list = isinstance(raw, list)  # n8n CLI export wraps in a list; repo def is a bare object
wf = raw[0] if is_list else raw
nodes = {n['name']: n for n in wf['nodes']}

nodes['Extract context']['parameters']['jsCode'] = EXTRACT_JS.replace('__SUPA_KEY__', KEY)
nodes['Build email']['parameters']['jsCode'] = BUILD_JS

# Save topics insert: body now carries topic_key (column added by the migration).
nodes['Save topics']['parameters']['jsonBody'] = "={{ JSON.stringify($('Build email').first().json.newTopics) }}"

json.dump(raw if is_list else wf, open(OUT, 'w'), indent=1, ensure_ascii=False)
print("written:", OUT)
print("nodes:", [n['name'] for n in wf['nodes']])
