# Crawli Agent Plan

This document captures the full agent strategy for Crawli — marketing automation,
service monitoring, and development workflow. Each section is a self-contained task
for a separate chat session to minimize token usage.

---

## Stack Decisions

| Layer | Tool | Why |
|-------|------|-----|
| Orchestration | n8n (self-hosted on Hetzner) | Visual, no-code, 400+ connectors, AI nodes |
| Social API | Zernio (MCP-ready, 15 platforms) | $6/account, 2 free, handles OAuth + maintenance |
| LLM (drafting) | DeepSeek V4 | 99% cheaper than Claude, good enough for content tasks |
| LLM (reasoning) | Claude Sonnet 4.6 | For complex reasoning, bug triage, architecture decisions |
| Agent framework | Hermes (if needed) | Persistent memory, self-learning, self-hosted |

---

## Prerequisites

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

#### 1C. X/Twitter — Replies + Posts
**Goal:** Selective quality posts + replies in fashion/thrift space

- Decision needed: Zernio ($6/mo) vs lightweight local Playwright script
- Lean toward Zernio for cleanliness (no script maintenance, ToS safer)
- Agent drafts 2-3 posts/replies per week (not daily — quality over volume)
- Surfaces to you for approval before posting
- Note: posts with URLs cost $0.200 each via X API (expensive) — use sparingly
- **Platform:** X/Twitter via Zernio (paid, $6/mo) or local script
- **Complexity:** Low (Zernio) / Medium (Playwright)

**Chat prompt to start:**
> "I want an n8n workflow that uses DeepSeek to draft 2-3 X/Twitter posts and replies per week about fashion/thrift/sustainable style, surfaces them to me for approval, then posts via Zernio. My X account needs to be connected as a paid Zernio account."

---

#### 1D. Instagram — Agent as Research + Draft Assistant
**Goal:** Agent handles research + content drafting; you execute manually

- Agent reads your Crawli Instagram analytics (reach, saves, best posts) via Instagram Graph API
- Drafts caption copy + hashtag sets for posts
- Drafts replies to comments → you review + send
- Weekly insight report: "Tuesday Reels get 3x more saves than feed posts"
- Recommends content ideas based on what's performing in fashion niche
- **You post manually** — no automation (Meta bans aggressively)
- **Platform:** Instagram Graph API (Business account required, no Zernio needed)
- **Complexity:** Medium (need Meta Developer app + App Review)

**Chat prompt to start:**
> "I want to set up Instagram Graph API access for my Crawli Business account, then build a workflow where an agent reads my analytics weekly and drafts caption + hashtag sets for upcoming posts, surfacing them to me for review."

---

#### 1E. TikTok — Pure Recommendation Engine
**Goal:** Agent researches trends, drafts scripts + ideas; you film + post manually

- Agent monitors trending sounds, hashtags, content formats in fashion/thrift/sustainable niche
- Monitors what Depop, ThredUp, Vestiaire post
- Drafts TikTok scripts + captions based on trending formats
- Weekly brief: "This week's TikTok ideas" with hooks, sounds, estimated reach
- **You film + post manually** — organic posting API is gated (partner program required)
- **Platform:** TikTok research via web scraping + trend APIs
- **Complexity:** Low (research only, no API needed)

**Chat prompt to start:**
> "I want a weekly TikTok research brief delivered to me automatically. An agent should monitor trending sounds, hashtags, and content formats in the fashion/thrift/sustainable niche, check what competitors (Depop, ThredUp, Vestiaire) are posting, and draft 3-5 content ideas with hooks and captions for me to film manually."

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

- **Model choice:** Plan originally specced DeepSeek V4, but **1A and 1B both use OpenAI gpt-4o-mini** (no DeepSeek key provisioned; gpt-4o-mini is cheap enough for drafting and matches the OpenAI-default / Gemini-backup provider preference). Revisit DeepSeek only if drafting volume/cost becomes a real concern. Claude Sonnet still intended for reasoning-heavy tasks (bug triage, architecture).
- **Hosting:** n8n self-hosted on existing Hetzner VPS alongside Crawli sidecar. No new server needed.
- **Zernio accounts used:** Reddit (free slot 1), Pinterest (free slot 2). X/Twitter would be first paid account ($6/mo) if Zernio chosen over Playwright.
- **Human-in-the-loop:** Reddit promotional comments always need approval before posting. Instagram + TikTok = agent drafts only, manual execution. Pinterest = fully automated.
- **Do not automate:** Instagram cold DMs, TikTok organic posting (both ToS violations with active enforcement).
