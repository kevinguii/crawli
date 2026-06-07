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

## Connected Accounts (Zernio — Free Tier)

- [x] **Reddit** — connected. Permissions: posts, comments, votes, DMs, flair, inbox
- [x] **Pinterest** — connected. Permissions: boards, pins, ads, followers

---

## Order of Attack

### Phase 1 — Marketing (Start Here)

#### 1A. Pinterest Auto-Pins ✅ Zernio free
**Goal:** Every new Crawli listing → auto-generate Pinterest Product Pin

- Trigger: new item scraped into Crawli
- Agent generates: pin title, description, hashtags, selects board
- Schedules via Zernio at optimal posting time
- Pulls weekly analytics (impressions, saves, click-throughs)
- **Platform:** Pinterest via Zernio
- **Complexity:** Low
- **ROI:** Highest of all marketing tasks (fashion = Pinterest's top vertical)
- **ToS risk:** None

**Chat prompt to start:**
> "I want to set up an n8n workflow that takes a new Crawli listing (title, image URL, price, platform, link) and automatically creates a Pinterest pin via Zernio MCP. Here's my Zernio API key and Pinterest account is already connected. Walk me through building this."

---

#### 1B. Reddit Monitoring + Draft Workflow ✅ Zernio free
**Goal:** Monitor target subreddits, surface relevant threads, draft replies for human approval

- Agent monitors daily: r/femalefashionadvice, r/frugalfemalefashion, r/streetwear, r/ThriftStoreHauls, r/malefashionadvice
- Flags threads where Crawli is genuinely relevant (secondhand, price, specific brands)
- Drafts contextual reply (value-first, Crawli mention only if natural)
- Surfaces draft to you (Slack/email/Telegram) for approve/edit/reject
- **You post manually** — agent never posts autonomously on Reddit (ban risk)
- Also: agent can upvote relevant posts + leave occasional non-promotional comments autonomously (low-risk)
- **Platform:** Reddit via Zernio
- **Complexity:** Low-Medium
- **ToS risk:** Low if human approves all promotional comments

**Chat prompt to start:**
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

- **Model choice:** DeepSeek V4 for high-volume drafting tasks (99% cheaper). Claude Sonnet for reasoning-heavy tasks (bug triage, architecture decisions).
- **Hosting:** n8n self-hosted on existing Hetzner VPS alongside Crawli sidecar. No new server needed.
- **Zernio accounts used:** Reddit (free slot 1), Pinterest (free slot 2). X/Twitter would be first paid account ($6/mo) if Zernio chosen over Playwright.
- **Human-in-the-loop:** Reddit promotional comments always need approval before posting. Instagram + TikTok = agent drafts only, manual execution. Pinterest = fully automated.
- **Do not automate:** Instagram cold DMs, TikTok organic posting (both ToS violations with active enforcement).
