# Crawli Agent Plan

This document captures the full agent strategy for Crawli — marketing automation,
service monitoring, and development workflow. Each section is a self-contained task
for a separate chat session to minimize token usage.

---

## Workflow-Building Rules (read before starting any n8n session)

**Never assume field names, output paths, or API shapes.** These are the most common source of broken workflows. Before writing any expression or mapping any field:

1. **Look it up** — fetch the official docs page, search the web, or use the n8n MCP to inspect the live node output. Do not guess.
2. **Check AGENT_PLAN.md gotchas first** — known landmines are documented under each completed section (1A, 1B). Read those before touching a related node.
3. **Verify with a test execution** — run the workflow up to the relevant node and inspect the actual output JSON before wiring downstream nodes to it.
4. **Use tools, not memory** — n8n node schemas change between versions. What was true in n8n 1.x may not be true in 2.x. Web search or MCP beats training data every time.

Known gotchas (do not repeat these):
- OpenAI Responses API node output: `output[0].content[0].text` (not `message.content`)
- n8n Code nodes use `.first()` not `.item` to reference other nodes
- Zernio `POST /v1/posts` requires `accountId` inside the `platforms` array
- Webhooks created via n8n REST API never register — use Schedule or Execute Workflow Trigger instead
- n8n SMTP credential requires `disableStartTls` field; Hetzner only allows port 587

---

## Tone Standard (applies to ALL content workflows)

All AI-drafted content must sound like a real person wrote it, not a brand or a bot. The reference is the Reddit workflow prompt (1B):

> "written like a real redditor; lead with genuinely useful help; mention Crawli only if it actually helps and never with marketing language; no em dashes, no exclamation marks"

**Rules for every prompt in this plan:**
- No em dashes (—), no exclamation marks
- No marketing language ("game-changing", "ultimate", "discover the power of")
- No preambles ("In today's fast-paced world…")
- Lead with the most interesting or useful thing, not a setup
- Sound like someone who actually uses secondhand fashion, not someone selling it
- Crawli gets mentioned when it's genuinely useful, not as a CTA

---

## Stack Decisions

| Layer | Tool | Why |
|-------|------|-----|
| Orchestration | n8n (self-hosted on Hetzner) | Visual, no-code, 400+ connectors, AI nodes |
| Social API | Zernio (MCP-ready, 15 platforms) | $6/account, 2 free, handles OAuth + maintenance. Covers Instagram, TikTok, X/Twitter, Pinterest, Reddit — no separate platform API keys needed |
| LLM (drafting) | OpenAI gpt-4o-mini | Cheap, fast, good enough for content tasks. DeepSeek shelved (no key provisioned) |
| LLM (reasoning) | Claude Sonnet 4.6 | For complex reasoning, bug triage, architecture decisions |
| SEO (interactive) | mcp-gsc (Google Search Console MCP) | ✅ Configured in VS Code. Ask Claude live questions about GSC data — queries, rankings, indexing issues |
| SEO (automated) | n8n native GSC node | Powers weekly automated SEO brief. Reuses same Google Cloud OAuth credentials |
| Agent framework | Hermes (if needed) | Persistent memory, self-learning, self-hosted. Not needed for Phase 1 |

---

## Prerequisites

### P2. mcp-gsc (Google Search Console MCP) ✅ DONE (2026-06-11)
**Summary:** mcp-gsc installed via `uvx`, configured in `.mcp.json`. Google Cloud OAuth credentials at `.gsc/gsc-client-secret.json` (gitignored — do not commit). OAuth app in Testing mode with `owner@example.com` as test user. Project: `fashion-crawler-c4ai`. Restart VS Code to activate; first run opens browser for Google auth, token saved permanently after.

**Config added to `.mcp.json`:**
```json
"gsc": {
  "command": "/opt/homebrew/bin/uvx",
  "args": ["mcp-search-console"],
  "env": {
    "GSC_OAUTH_CLIENT_SECRETS_FILE": "/Users/kevingui/Documents/Work/me/fashion-crawler-crawl4ai/.gsc/gsc-client-secret.json"
  }
}
```

**Usage:** In any Claude Code session, ask questions like "what queries am I ranking on page 2 for?" or "check indexing issues on thecrawli.com" — Claude pulls live GSC data.

---

### P1. n8n Self-Hosted Setup ✅ DONE
**Summary:** n8n installed globally via npm, running as systemd service on port 5678. nginx configured to reverse proxy. SSL cert issued. DNS removed (kept private). Access via SSH tunnel: `ssh -L 5678:localhost:5678 root@5.78.187.97` then visit `http://localhost:5678`.

**Access Method:**
```bash
ssh -L 5678:localhost:5678 root@5.78.187.97
# Visit http://localhost:5678 in browser
```

---

## Connected Accounts (Zernio — Free Tier)

- [x] **Reddit** — connected. Permissions: posts, comments, votes, DMs, flair, inbox
- [x] **Pinterest** — connected. Permissions: boards, pins, ads, followers

---

## Order of Attack

### Phase 1 — Marketing (Start Here)

#### 1A. Pinterest Auto-Pins ✅ DONE

**What was built:** n8n workflow (published as v3, named "v1") — Supabase `saves` table INSERT → Supabase DB webhook → n8n webhook → OpenAI gpt-4o-mini generates pin description + hashtags → Zernio REST API creates Pinterest pin.

**Key details:**
- Webhook URL: `https://n8n.thecrawli.com/webhook/16af4402-a997-4ad8-8ea0-286ea8ae6035`
- Pinterest account ID: `6a2506e02b2567671a0b8721` (username: thecrawli)
- Board: "Second Hand Fashion Finds" — ID `1089308297311595703`
- Image fallback: `https://thecrawli.com/opengraph-image` (for saves with no image_url)
- Pin link: always `https://thecrawli.com`
- DNS: `n8n.thecrawli.com` A record → `5.78.187.97` (Cloudflare proxied) — must stay active for Supabase webhooks to reach n8n

**n8n gotchas learned:**
- OpenAI node output path: `output[0].content[0].text` (Responses API format, not `message.content`)
- Use a Code node (not JSON template body) to build the Zernio payload — AI text contains newlines + quotes that break JSON templates
- Zernio `POST /v1/posts` requires `accountId` inside the `platforms` array (not documented prominently)
- Set node expression mode doesn't evaluate in JSON mode — use Code node instead
- n8n Code nodes use `.first()` not `.item` to reference other nodes

---

#### 1B. Reddit Monitoring + Draft Workflow ✅ DONE (2026-06-09)

**What was built:** n8n workflow "reddit monitor crawli" (ID `URiVWju6wMJcrQiW`) — Schedule (daily 14:00 UTC) OR on-demand trigger → Code builds one OR-keyword query per subreddit → Zernio `GET /v1/reddit/search` (one call per subreddit, 5s apart) → Code dedupes + filters to last 24h → OpenAI gpt-4o-mini scores relevance 0-10 and drafts a reply (strict JSON) → Code keeps score ≥7 and builds an HTML digest → Email digest to owner@example.com. **You post manually** — workflow never posts to Reddit.

**Verified end-to-end 2026-06-09** (execution #22): 17 posts collected → 2 drafts kept → email accepted by Gmail.

**Key details:**
- Reddit Zernio account ID: `6a2507082b2567671a0b890c` (username `Majestic_Crawli6792`) — found via `GET https://zernio.com/api/v1/accounts`, `_id` field
- Subreddits (8, curated 2026-06-09, ordered best-first): poshmark, ThriftStoreHauls, Depop, malefashionadvice, Mercari, vinted, reselling, Grailed. Schedule fires **4am Pacific** (workflow `settings.timezone` pinned to `America/Los_Angeles` — n8n defaults to America/New_York when `GENERIC_TIMEZONE` is unset, not the server's UTC); search node 60s spacing, `onError:continueRegularOutput`. **History:** original 5 (femalefashionadvice, frugalfemalefashion, streetwear, ThriftStoreHauls, malefashionadvice) → execution-22 analysis showed 3 of them yield **0 posts/day** for the keyword set (all yield came from ThriftStoreHauls + malefashionadvice; poshmark when added returned 18). Briefly expanded to 15, but hit a hard wall:
  - **Zernio free tier throttles ~6–8 Reddit searches per run.** The error "The service was not able to process your request" is Zernio's *upstream* Reddit call being rate-limited (Reddit limiting Zernio's one shared OAuth account), NOT Zernio's own 60/min limit. 15 subs @10s → 9 failed; @90s → 7 failed (9× spacing barely helped → it's a cumulative per-account quota, not per-call rate). So trimmed to 8, ordered best-first so any throttle drops the low-yield tail. **PRAW (own app, 100 QPM) is the only real fix for going wider — shelved on Reddit's approval gate.**
  - The `limit=50` cap is hit on every sub but never truncates the 24h window (even the busiest sub's 50 results span 76h back), so raising `limit`/paginating adds nothing at 24h.
  - Verification of the 8-sub config deferred to the first clean 4am scheduled run (heavy same-day testing depleted the shared Reddit quota; check execution results in the morning).
- LLM: **gpt-4o-mini** (not DeepSeek — no DeepSeek key, and reuses existing OpenAI cred; matches provider preference)
- Reuses creds: Zernio header auth `fJu32HkmtmjvrZhX`, OpenAI `eQUItcjo7Td6T6Ui`
- Email cred: Gmail SMTP `m3Zfuf10aGoLQhov` — **port 587 STARTTLS** (Hetzner blocks 465 + 25; only 587 is open). Uses a Gmail app password.
- Definition checked into repo: `docs/workflows/reddit-monitor.json`

**Run on demand:**
- n8n UI: open the workflow → **Execute Workflow** button
- CLI/SSH: `ssh root@5.78.187.97 'N8N_RUNNERS_BROKER_PORT=5690 N8N_RUNNERS_BROKER_LISTEN_ADDRESS=127.0.0.1 n8n execute --id URiVWju6wMJcrQiW'` (broker-port override needed because the live service holds default 5679)

**Change schedule:** edit the "Daily 14:00 UTC" Schedule Trigger node in the UI (or PATCH the workflow via API). Currently daily at 14:00 UTC.

**n8n 2.x gotchas learned:**
- **Webhooks created via the public REST API never register** ([n8n #21614](https://github.com/n8n-io/n8n/issues/21614)) — registration is a frontend-only internal call. Schedule triggers DO activate via API. So on-demand uses an Execute-Workflow Trigger node, not a webhook.
- `n8n execute --id` requires an **Execute Workflow Trigger** node in the workflow, and conflicts with the running service on broker port 5679 unless `N8N_RUNNERS_BROKER_PORT` is overridden.
- n8n 2.x smtp credential schema **requires `disableStartTls`**; public API has no credential-update (PUT 405) — delete + recreate to change.
- Zernio reddit search passes through to Reddit's search API: **no full-feed endpoint** (empty `q` returns 0; `q=*` only matches stickies) and it **429s under burst** — HTTP node has 5s batching + 3× retry. Daily use (5 spaced calls) stays well under the limit.

**PRAW evaluated + shelved (2026-06-09):** Considered replacing the Zernio search with a self-hosted **PRAW** (official Reddit Data API) sidecar to beat the burst-429 ceiling. **Shelved — staying on Zernio.** Reddit's Responsible Builder Policy (2025-11-11) ended self-service API keys: creating an app now needs an approval application (~7 days–4 weeks) and the free tier is non-commercial-only, which Crawli's marketing use isn't. Zernio already holds an approved Reddit relationship, so it absorbs that. PRAW code is kept drop-in-ready (`reddit-service/`, `docs/workflows/reddit-monitor-praw.json`, steps in `reddit-service/README.md`) for if an app is ever approved.

**Coverage levers within Zernio (for "scrape more than 5"):** Zernio search (docs.zernio.com/reddit-search/search-reddit) supports `after` cursor pagination + `limit` up to **100** (default 25; workflow uses 50); response includes `after`/`before`; Reddit hard-caps 1000 items/listing. Key insight: verified run #22 collected only 17 posts across 5 subreddits in 24h — we're not hitting the per-call cap, so pagination alone is no help at the 24h window. Effective levers, in priority: (1) **more subreddits** (the Reddit account already subscribes to poshmark, depop, vinted, Mercari, Grailed, reselling, Thrift, SecondHandFinds, frugalmalefashion, etc.); (2) **wider time window** (24h→48–72h) — but on a daily schedule this re-surfaces the same threads, so it needs **cross-run dedup** (store emailed post IDs in Supabase); (3) bump `limit` 50→100 + paginate as headroom once the window is wide enough to exceed 100 matches/subreddit.

**Chat prompt to start:** *(complete — kept for reference)*
> "I want an n8n workflow that monitors specific subreddits (r/femalefashionadvice, r/frugalfemalefashion, r/streetwear, r/ThriftStoreHauls, r/malefashionadvice) daily via Zernio, uses DeepSeek to draft replies where Crawli is relevant, and sends drafts to me for approval before posting. Reddit account is connected via Zernio."

---

#### 1C/1D/1E. Daily Content Email — X/Twitter, Instagram, TikTok ✅ DONE (2026-06-11)

**Workflow:** `crawli daily content email` — ID `FMf2nyTQIZNCRa2L`, active, fires daily 8am Pacific.
**Definition:** `docs/workflows/daily-content-email.json`

**Run on demand:**
- n8n UI: open `crawli daily content email` → Execute Workflow
- CLI/SSH: `ssh root@5.78.187.97 'N8N_RUNNERS_BROKER_PORT=5690 N8N_RUNNERS_BROKER_LISTEN_ADDRESS=127.0.0.1 n8n execute --id FMf2nyTQIZNCRa2L'`

---

#### 1C. X/Twitter — Blog Cross-Posts ✅ DONE (2026-06-11, folded into daily email)
**Goal:** X gets the same content as the blog — informal, opinionated takes. No automation, no Zernio (free slots used by Pinterest + Reddit). You paste and post manually.

**Decided (2026-06-11):**
- **No Zernio for X** — free plan is 2 accounts (Pinterest + Reddit already taken). X would be a paid slot ($6/mo) — not worth it yet.
- No $100/mo X API either. Fully manual.
- Format: short, opinionated post. Same idea as the blog but punchier. Written like a person, not a brand.
- Volume: whenever you publish a blog post. Not on a separate schedule.
- The daily email includes an X-ready version alongside each blog brief — you copy, paste, done.

**Tone (same rule as Reddit prompt):** Written like a real person. No em dashes, no exclamation marks, no marketing language. Lead with the most interesting point, not a preamble.

**Chat prompt to start:**
> "Add an X/Twitter version to each blog brief in the daily email. Format: 1-3 sentences, opinionated, written like a person not a brand, no em dashes, no exclamation marks, no hashtags unless they're genuinely relevant. Same idea as the blog post, just punchy. I'll copy-paste and post manually."

---

#### 1D. Instagram — Daily Content Ideas + Slideshow Drafts ✅ DONE (2026-06-11)
**Goal:** Daily email with content ideas tailored for Instagram. You create + post manually.

**Decided (2026-06-11):**
- No Meta Graph API needed for this phase — ideas only, no analytics reading yet
- Platform: Zernio for posting when ready (already handles Instagram OAuth)
- Format: varies heavily — carousels, slideshows, single images, text posts, Reels ideas. NOT always 10 slides. Intentional format variety especially early on while testing what works.
- Posting: **manual** — Meta bans aggressive automation

**Crawli audience on Instagram (3 segments):**
| Segment | Mindset | Tone | Keywords |
|---------|---------|------|----------|
| Fashionistas | Aspirational, brand-conscious, smart luxury | Polished, curated | discover, rare, investment, find |
| Vintage community | Sustainability, the hunt, authenticity | Authentic, storytelling | thrift, vintage, secondhand, slow fashion |
| Resellers | Profit, arbitrage, early access | Tactical, insider | flip, deals, source, resell |

**Content mix starting weights (adjust as data comes in):**
- ~40% discovery/deal hooks ("found this for $X" energy)
- ~25% educational (how to spot fakes, what resellers know)
- ~20% trend-riding (tie to current fashion moment)
- ~15% POV/opinion ("buying new for luxury is mostly a scam")

**Daily email includes:** 10 ideas ranked by estimated effectiveness, each with: format suggestion, target segment, caption angle, hashtag direction.

**Chat prompt to start:**
> "I want a daily 8am n8n workflow that emails me 10 Instagram content ideas for Crawli — a platform that searches secondhand marketplaces. Audience has 3 segments: fashionistas (aspirational, smart luxury), vintage community (sustainability, the hunt), and resellers (profit, arbitrage). Ideas should vary in format (carousels, slideshows, single images, Reels concepts), ranked by estimated effectiveness. Content mix: 40% discovery/deal hooks, 25% educational, 20% trend-riding, 15% opinion. Include: format, target segment, caption angle, hashtag direction for each. Send to owner@example.com."

---

#### 1E. TikTok — Daily Content Ideas ✅ DONE (2026-06-11, same email as 1D)
**Goal:** Daily ideas tailored for TikTok's audience and format. You film + post manually.

**Decided (2026-06-11):**
- Ideas delivered in the **same daily email as Instagram** (1D) — each idea has both an IG version and a TikTok version
- No separate TikTok API needed — content only, no posting automation
- Organic posting API is gated (TikTok partner program required) — manual posting is fine for now
- Zernio has TikTok support for when automation is needed later

**Update (2026-06-18):** Zernio's TikTok slot (freed from Reddit, which moved to PRAW — see HANDOFF §0) is now live and connected to `@thecrawli` with `video.publish`/`video.upload`/`video.list`/`user.info.stats` scopes already granted. Posting is still 100% manual (all posts so far are `isExternal: true`), but analytics are now being tracked: **"tiktok performance digest"** workflow (`9QUnEUbl66Zxwl7D`, weekly Monday 8am PT) pulls Zernio's `/v1/analytics`, ranks posts, breaks out top hashtags + format performance, and emails + saves to `tiktok_performance`. Full details in HANDOFF.md top entry. Agreed next steps in order: (1) this digest — done, (2) wire `reddit_research` pain points into the content-brief generator — done, and the resulting batch was turned into 13 social posts + 7 blog posts the same day (see HANDOFF.md top entry), (3) automated posting via `video.publish` — not started. Native-video-vs-carousel A/B testing is paused until the digest has a few weeks of data — the account is too new (3 followers, ~3 days of posts) to separate format effect from cold-start effect.

**Crawli audience on TikTok (same 3 segments, different energy):**
| Segment | Mindset | Tone | Keywords |
|---------|---------|------|----------|
| Fashionistas | Trend-chasing, FOMO, visual | Fast, exciting, "omg look at this" | haul, find, score, this is giving |
| Vintage community | Discovery joy, aesthetic, character | Raw, enthusiastic, slightly chaotic | thrifted, vintage haul, thrift with me |
| Resellers | Tips + tricks, hustle, inside knowledge | Educational but punchy | how I, reselling tips, profit, sold |

**Key IG vs TikTok differences to enforce:**
- TikTok: hook must land in first 2 seconds. Lead with the most interesting thing.
- TikTok: entertainment > education. Even educational content needs to be entertaining first.
- TikTok: trending sounds/formats matter. Ideas should note if they're tied to a current trend.
- Instagram: more polished, aesthetic, carousels do well. Captions can be longer.

**Chat prompt to start:**
> "I want the daily n8n content email (from 1D) to include TikTok versions of each idea. For TikTok: hook lands in 2 seconds, entertainment-first even for educational content, note any trending formats or sounds to piggyback on. Same 3 audience segments as Instagram but different tone: faster, rawer, more 'omg I found this' energy. Include both IG and TikTok version for each of the 10 ideas."

---

#### 1G. Weekly SEO Brief ✅ DONE (2026-06-11)
**Goal:** Weekly automated SEO brief. You write the actual posts; agent handles all the research.

**Note on daily blog ideas:** Already built in the daily content email (1C/1D/1E, workflow `FMf2nyTQIZNCRa2L`). Not duplicated here.

**Two-layer setup:**

**Layer 1 — mcp-gsc (interactive, already live ✅)**
Ask Claude live questions during any session: "what's ranking page 2?", "what queries lost clicks this week?", "check indexing on thecrawli.com". No workflow — just talk to Claude.

**Layer 2 — n8n weekly SEO brief (automated ✅)**
Workflow: `crawli weekly seo brief` — fires every Monday 8am Pacific.
- Refreshes Google OAuth token using stored refresh token (no n8n OAuth credential needed)
- Queries GSC `searchAnalytics` API: last 28 days, `dimensions: ["query","page"]`, up to 200 rows
- Filters keyword gaps at positions 5–20 (early site — lenient range)
- If sparse GSC data: brief pivots to LLM-generated niche topic research for secondhand fashion
- OpenAI gpt-4o-mini generates: 2 prioritized content briefs with target keyword, secondary keywords, audience, angle, hook sentence, 4 supporting points, X-ready sentence
- One HTML email to owner@example.com

**Key details:**
- Weekly brief workflow ID: `5CC5C89EEEE2417C` — active, Monday 8am PT
- Daily email workflow ID: `FMf2nyTQIZNCRa2L` — active, daily 8am PT (updated to read context)
- Definitions: `docs/workflows/weekly-seo-brief.json`, `docs/workflows/daily-content-email.json`
- Supabase `seo_context` table: `id=1` single-row upsert, `keywords_json` jsonb, service role only
- Auth: refresh token flow (same Google Cloud project `fashion-crawler-c4ai`)
- LLM: gpt-4o-mini, reuses OpenAI cred `eQUItcjo7Td6T6Ui` + Gmail SMTP cred `m3Zfuf10aGoLQhov`

**Run on demand:**
- Weekly brief: `ssh root@5.78.187.97 'N8N_RUNNERS_BROKER_PORT=5690 N8N_RUNNERS_BROKER_LISTEN_ADDRESS=127.0.0.1 n8n execute --id 5CC5C89EEEE2417C'`
- Daily email: `ssh root@5.78.187.97 'N8N_RUNNERS_BROKER_PORT=5690 N8N_RUNNERS_BROKER_LISTEN_ADDRESS=127.0.0.1 n8n execute --id FMf2nyTQIZNCRa2L'`

**How context flows:**
1. Monday 8am: weekly brief runs GSC query → OpenAI generates 10-12 keywords, 4-5 clusters, top 3 priorities → upserts full map to Supabase `seo_context` → sends keyword map email
2. Daily 8am (Tue-Sun): daily email reads `seo_context` → injects keyword list into social ideas prompt (3-4 of 10 ideas) and blog brief prompt (2-3 of 4 briefs) → sends content email with green "SEO context active" badge
3. Before first Monday run: daily email falls back to original prompts, no SEO context badge

---

#### 1F. Unified Marketing Report
**Goal:** Weekly report across all platforms in one message

Covers:
- Pinterest: pins published, impressions, saves, click-throughs to crawli.com
- Reddit: threads monitored, drafts sent, approved comments posted
- Instagram: followers, best post, unanswered comments
- X/Twitter: posts, impressions, profile visits
- TikTok: content ideas delivered this week
- Traffic from social → Crawli (Google Analytics)

**Chat prompt to start:**
> "I want a unified weekly marketing report that pulls data from Pinterest and Reddit via Zernio, Instagram via Graph API, X/Twitter via Zernio, and Google Analytics via GA4 connector, then formats it into a single readable report and delivers it to me every Monday morning."

---

### Phase 2 — Service Dashboard

**Goal:** Morning report from all Crawli services in one message. No more tab-switching.

Services to pull from:

| Service | Integration | Status |
|---------|------------|--------|
| Stripe | Official MCP | Ready |
| Supabase | Official MCP | Ready |
| Sentry | Official MCP | Ready |
| Cloudflare | Official MCP | Ready |
| Google Analytics | Composio MCP | Ready |
| Hetzner | REST API | Needs wrapper |
| UptimeRobot | REST API | Needs wrapper |
| Firecrawl | REST API | Needs wrapper |
| Brave Search | REST API | Needs wrapper |

**Report format (delivered daily):**
```
Crawli Morning Report — [Date]

Revenue: $X MRR (+/-% WoW) [Stripe]
Active users: X [Supabase]
Sentry: X new errors — breakdown by severity
Hetzner: X% uptime, CPU avg X%
Firecrawl: X credits used this week, X remaining
Search traffic: +/-% impressions [Google Search Console]
Cloudflare: X requests, X threats blocked
UptimeRobot: X incidents (if any)
```

**Chat prompt to start:**
> "I want to build a daily Crawli service dashboard agent. It should pull from Stripe (Official MCP), Supabase (Official MCP), Sentry (Official MCP), Cloudflare (Official MCP), Google Analytics (Composio MCP), and make REST calls to Hetzner, UptimeRobot, Firecrawl, and Brave Search APIs. Compile everything into a morning report delivered to me daily. Here are my API keys: [add when starting chat]"

---

### Phase 3 — Development Workflow Agent

**Goal:** Agent handles grunt work so you can focus on product decisions.

#### 3A. Bug Triage
- Monitors Sentry + scraper logs
- Categorizes errors by severity
- For small bugs: creates GitHub PR with fix proposal
- For larger issues: creates GitHub issue with root cause analysis
- You review PRs, approve or iterate

#### 3B. Vulnerability Scanning
- Weekly dependency scan
- Ranks vulnerabilities by severity
- Proposes patches via PR for low-risk ones
- Flags high-severity for your decision

#### 3C. Feature Research
- Scans target subreddits weekly for user pain points
- Monitors competitor apps (Depop, Vestiaire, ThredUp) for new features
- Proposes feature ideas grounded in actual user complaints
- Delivers weekly "product insights" brief

#### 3D. Architecture Doc Maintenance
- Auto-updates HANDOFF.md + CLAUDE.md after significant changes land
- Keeps service inventory current (new APIs added, services changed)
- Prevents context loss between Claude Code sessions

**Chat prompt to start:**
> "I want to set up a development workflow agent for Crawli that: (1) monitors Sentry + scraper logs and creates GitHub issues/PRs for bugs, (2) runs weekly dependency vulnerability scans, (3) scans fashion subreddits for feature ideas, (4) auto-updates HANDOFF.md after significant changes. Here's the repo: [repo URL]. Walk me through setting this up with Hermes or n8n."

---

### Phase 4 — Adaptive Scraping

**Goal:** Make scraping less brittle when platform layouts change.

- Keep current rule-based approach (JSON-LD + Playwright) for stable platforms
- Agent fallback when selectors break (e.g., eBay already broken)
- When rules fail: agent reasons about DOM → extracts data → suggests new selector
- You approve new selector → locked into rules for next run
- Targeted for new platform onboarding (agent maps structure, you confirm)

**Chat prompt to start:**
> "I want to add an agent-based scraping fallback to Crawli's existing Playwright pipeline. When a CSS selector fails (returns null or errors), instead of giving up, the agent should analyze the page HTML, extract the target data (price, size, title, image), and suggest a new selector to lock in. Walk me through adding this to the existing crawl4ai-service."

---

## Notes

- **Model choice:** All drafting workflows use **OpenAI gpt-4o-mini** (no DeepSeek key provisioned; cheap enough, matches OpenAI-default preference). Claude Sonnet 4.6 for reasoning-heavy tasks (bug triage, architecture, interactive sessions).
- **Hosting:** n8n self-hosted on existing Hetzner VPS. No new server needed.
- **Zernio accounts used:** Reddit (free slot 1), Pinterest (free slot 2). X/Twitter = first paid account ($6/mo) when ready to auto-post. Instagram/TikTok also available via Zernio when needed.
- **X/Twitter:** No API, no Zernio (free slots taken). Blog cross-posts only, fully manual. X-ready version included in daily email alongside blog brief.
- **Human-in-the-loop:** Reddit promotional comments always need approval. Instagram = agent drafts only, manual execution. Pinterest = fully automated. Blog posts = you write from brief, manual publish. **TikTok (updated 2026-06-18):** an automated posting workflow now exists (`tiktok auto post`, n8n ID `FRgQYRidYXfNX2dI`) using Zernio's official TikTok Content Posting API, defaults to `draft` mode (lands in the TikTok Creator Inbox for one manual tap, not a fully unattended publish). Built but never executed as of this writing — still effectively manual-execution in practice, just with the heavy lifting automated when you choose to invoke it.
- **Daily email:** One email at 8am containing: 10 social content ideas (IG + TikTok versions), 3-5 blog post ideas (briefs only). All to owner@example.com.
- **SEO:** Two layers — mcp-gsc for interactive Claude sessions (live ✅), n8n GSC node for weekly automated brief (to build). Same Google Cloud OAuth credentials for both.
- **mcp-gsc config:** VS Code only (`.mcp.json`). Claude Desktop has separate config at `~/Library/Application Support/Claude/claude_desktop_config.json` — not configured there yet, not needed.
- **Do not automate:** Instagram cold DMs (genuine ToS violation with active enforcement, unofficial path). **TikTok organic posting note updated 2026-06-18:** this line originally grouped TikTok in with the Instagram DM risk because both were unofficial/scraped automation paths. That's no longer accurate for TikTok specifically — Zernio's TikTok integration uses TikTok's own official Content Posting API with OAuth scopes the account has actually granted (`video.publish`, `video.upload`), not a scraped workaround. A `tiktok auto post` workflow now exists for this (see Human-in-the-loop note above), defaulting to draft mode as a safety margin. Instagram cold DMs remain off-limits.
