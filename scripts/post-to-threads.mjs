/**
 * Post a blog article to Threads via Zernio, on demand. No n8n involved - this
 * is a manual-invocation tool, so a Code-node/workflow layer just adds ceremony
 * (n8n's CLI `execute` has no way to pass custom trigger input short of a
 * wrapper workflow) for no benefit over calling OpenAI + Zernio directly.
 *
 *   node --env-file=.env scripts/post-to-threads.mjs <slug> "<title>" "<hook>" "<url>" [imageUrl] [--draft]
 *
 * Example:
 *   node --env-file=.env scripts/post-to-threads.mjs \
 *     best-secondhand-marketplaces-for-luxury-items \
 *     "Best Luxury Resale Sites: Same Bag, $600 Price Gap" \
 *     "Same Chanel bag: $2,800 on one platform, $3,400 on another" \
 *     "https://thecrawli.com/blog/best-secondhand-marketplaces-for-luxury-items"
 *
 * Pass --draft (anywhere in the args, imageUrl optional either way) to only
 * draft the caption via OpenAI and print it - no Zernio call, no publish, no
 * content_history write. Zernio itself has no real Threads draft concept: its
 * `publishNow:false` just parks the post in Zernio's own dashboard queue (same
 * as the TikTok flow), not anywhere Threads shows you a draft, so --draft here
 * just skips straight to "show me the text" instead.
 *
 * Requires (already in .env): OPENAI_API_KEY, ZERNIO_API_KEY (skippable in
 * --draft mode), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Uses
 * Node's built-in --env-file flag (Node 20.6+) - no dotenv dependency needed.
 *
 * Threads' own post field is hard-capped at 500 characters (Zernio doesn't
 * support Threads' separate 10k-character text-attachment feature at all).
 * Rather than truncate, this asks the model for an optional second post (a
 * real Threads reply) when there's a genuinely distinct second detail worth
 * adding - Threads' native mechanism for saying more than one post's worth.
 *
 * THREADS_ACCOUNT_ID below was fetched live via Zernio's GET /v1/accounts on
 * 2026-07-06. Zernio account IDs are NOT stable across reconnects (bit the
 * Pinterest workflow on 2026-07-01) - re-fetch if this ever 403s with
 * "One or more accounts do not belong to this user".
 */

const THREADS_ACCOUNT_ID = '6a4c55359d9472faae9f8bea'; // thecrawli

const rawArgs = process.argv.slice(2);
const draftOnly = rawArgs.includes('--draft');
const [slug, title, hook, url, imageUrl] = rawArgs.filter((a) => a !== '--draft');

if (!slug || !title || !hook || !url) {
  console.error(
    'Usage: node scripts/post-to-threads.mjs <slug> "<title>" "<hook>" "<url>" [imageUrl] [--draft]',
  );
  process.exit(1);
}
if (!url.startsWith('https://thecrawli.com/blog/')) {
  console.error('url must be a https://thecrawli.com/blog/... link');
  process.exit(1);
}

const SYSTEM_PROMPT = `You write Threads posts for Crawli, a free tool that compares resale prices across 9 marketplaces (Grailed, Depop, Mercari, Poshmark, Vinted, StockX, eBay, ThredUp, Vestiaire Collective) for resellers and flippers.

Threads has its own voice, distinct from a blog post, a Reddit comment, or a TikTok caption. It reads like a text to a friend about something you noticed, not an announcement. Real Threads posts:
- Open with the single most specific or surprising detail, never a summary sentence like "New post:" or "I wrote about..."
- Use short lines and natural line breaks for rhythm, not one dense paragraph
- Never stack hashtags at the end, never use decorative emoji, no exclamation marks, no em dashes
- Never sound like a press release or a listicle recap. Do not use any of these phrases or close variants: "check out", "exciting", "we just published", "don't miss", "here's how", "stacks up against"
- Do not summarize the article ("if you're flipping luxury, knowing where to list can make a difference") - state the one specific fact itself and stop
- End the thought on the concrete detail. Put the URL in exactly one place: the very end of the last post in the thread (the root if there's no reply, otherwise the reply) - never repeat it in both

Threads hard-caps every individual post at 500 characters - that's Meta's own platform limit, not a style choice, so never write a single post you expect to get cut off. When there's more worth saying than fits in one post, use a real Threads reply chain instead of cramming or truncating: write a short punchy root post, then a natural follow-up reply that adds one more genuinely distinct, specific fact (a different number, a different platform, a concrete comparison) - not generalized advice or a restatement of the root. Most of the time one post is enough; only add a reply when there's real second material.

Output STRICT JSON only, no markdown fences, no explanation, with exactly these keys:
{"root": "<the lead post, under 490 characters, leads with the hook in your own words>", "reply": "<a follow-up reply under 490 characters ONLY if there is a genuinely distinct second fact worth adding, otherwise an empty string>"}`;

function capGracefully(text, max) {
  if (text.length <= max) return text;
  const hardSlice = text.slice(0, max);
  const lastStop = Math.max(hardSlice.lastIndexOf('. '), hardSlice.lastIndexOf('\n'));
  if (lastStop > max * 0.6) return hardSlice.slice(0, lastStop + 1).trim();
  const lastSpace = hardSlice.lastIndexOf(' ');
  return (lastSpace > 0 ? hardSlice.slice(0, lastSpace) : hardSlice).trim();
}

async function draftCaption() {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Title: ${title}\nHook: ${hook}\nURL: ${url}` },
      ],
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  let root = capGracefully(String(parsed.root || '').trim(), 500);
  let reply = parsed.reply ? capGracefully(String(parsed.reply).trim(), 500) : '';

  if (!root.includes(url) && !reply.includes(url)) {
    if (reply) {
      reply = capGracefully(reply, 500 - url.length - 2) + '\n\n' + url;
    } else {
      root = capGracefully(root, 500 - url.length - 2) + '\n\n' + url;
    }
  }
  return { root, reply };
}

function buildZernioPayload({ root, reply }) {
  // Zernio requires top-level `content` on every request regardless of
  // threadItems, despite docs.zernio.com/platforms/threads saying it's
  // "optional if threadItems provided" - confirmed empirically (a threadItems-only
  // request 400s with "Content is required for selected platforms"). So `content`
  // is always the root post; threadItems holds only the *additional* reply
  // post(s), not a duplicate of the root.
  const platformTarget = { platform: 'threads', accountId: THREADS_ACCOUNT_ID };
  const payload = { publishNow: true, content: root, platforms: [platformTarget] };
  if (imageUrl) payload.mediaItems = [{ type: 'image', url: imageUrl }];
  if (reply) {
    platformTarget.platformSpecificData = { threadItems: [{ content: reply }] };
  }
  return payload;
}

async function postToZernio(payload) {
  const resp = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: resp.ok, status: resp.status, json };
}

// Best-effort - never blocks reporting the actual post result.
async function logToContentHistory() {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/content_history`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ kind: 'threads', title, topic_key: slug, posted: true }),
    });
  } catch {
    // logging is best-effort
  }
}

const caption = await draftCaption();
console.log('--- Draft ---');
console.log('root:', JSON.stringify(caption.root));
if (caption.reply) console.log('reply:', JSON.stringify(caption.reply));

if (draftOnly) {
  console.log('--- --draft set: not posted to Zernio/Threads, not logged to content_history ---');
  process.exit(0);
}

const payload = buildZernioPayload(caption);
const result = await postToZernio(payload);

console.log('--- Zernio response ---');
console.log('status:', result.status);
console.log(JSON.stringify(result.json, null, 2));

if (result.ok) {
  await logToContentHistory();
  console.log('--- Logged to content_history ---');
} else {
  console.error('Post failed - not logging to content_history.');
  process.exit(1);
}
