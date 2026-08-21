 # Claude Code Guidelines for This Project

**Read this file at the start of every session.**

## Documentation structure

The project uses four focused docs. Read what's relevant to your task — don't read all four every session.

| File | What's in it | Read when |
|---|---|---| 
| `HANDOFF.md` | Current platform state, open issues, recent changes, env setup | Every session |
| `docs/core/PITFALLS.md` | Gotchas that will bite you if you don't know them | Before touching scraping, filtering, n8n, or Supabase | 
| `docs/core/PLATFORM_STATUS.md` | Per-platform scraping method, selectors, status, open issues | Before touching any platform extraction |
| `docs/core/SYSTEM_DESIGN.md` | Architecture, search engine internals, cost model, data layer | When adding new features or understanding flow |

**Supporting docs:**
- `docs/CHANGELOG.md` — session history older than the newest 5 entries in HANDOFF.md. **Do not read by default**; open it only to trace why a specific past change was made.
- `SCALING.md` (repo root) — tier playbook: hosting, throughput, infra choices at scale X. **Read before answering any scaling/hosting/throughput question and quote it — do not improvise scaling advice from training data.** Referenced from `app/api/watchlist/refresh/route.ts`.
- `docs/reference/SERVER_REFERENCE.md` — SSH, n8n workflow edits, deployment
- `docs/reference/B2B_FEATURE_TRUTH.md` — what features actually exist (source of truth for landing copy)
- `docs/reference/FIRECRAWL_PRICING.md` — Firecrawl credit costs
- `docs/reference/CLEANUP.md` — freeing ports 3000/8000 before finishing a session
- `docs/marketing/POSTS_README.md` — carousel batch operation
- `docs/planning/GROWTH_PLAN.md` — distribution + conversion roadmap, SEO/AEO strategy. **Its TikTok numbers are the June 2026 carousel burst and are stale** — current content is a different motion, see `AUDIENCE_AND_HOOKS_PLAN.md` F6
- `docs/planning/AUDIENCE_AND_HOOKS_PLAN.md` — **live multi-session program** with its own status board: audience research (the skipped Step 0), Reddit language file, channel ranking, video idea triage and hooks. **Read the status board before any audience, hook, or video-idea work, and update it as you go.**
- `docs/planning/COMPETITIVE_POSITIONING.md` — competitive analysis (Beni/Gem/Underpriced AI), the positioning decision, and **§6 value-prop ledger + experiment log**. **Read §6 before any onboarding, landing-copy, or marketing work, and log every experiment there.** Copy may only use a claim the ledger marks Validated.

## Available MCP tools

These MCP servers are connected in this project. Use them instead of manual API calls or guessing.

| MCP | When to use |
|---|---|
| `mcp__gsc__*` | Fetch GSC search analytics, inspect URLs, list sitemaps, check indexing |
| `mcp__google-seo-mcp__*` | CrUX/Core Web Vitals, GA4 traffic, Lighthouse audits, SERP checks, schema validation, sitemap diffs |
| `mcp__geo-optimizer__*` | AEO/GEO audits — AI crawler access, llms.txt, citability, brand mention signals |
| `mcp__claude_ai_Supabase__*` | Run SQL, apply migrations, list tables, check logs — always use over guessing schema. Project id `peyqxfijdrziqfjkxjsn`. (Older docs call this `mcp__supabase__*`; the namespace changed) |
| `mcp__n8n__*` | Search/trigger n8n workflows (content brief `moMVEnr5L6kGgJTC` is the TikTok carousel brief). **Often not connected** — if the tool is absent, SSH to the box instead: `ssh root@5.78.187.97`, see `docs/reference/SERVER_REFERENCE.md` |
| `mcp__playwright__*` | Browser automation — navigate, screenshot, fill forms. Use for UI verification |
| `mcp__claude_ai_Gmail__*` | Read/send email — only when user explicitly asks |
| `mcp__claude_ai_Google_Calendar__*` | Calendar — only when user explicitly asks |

**Service account** for GSC + GA4: `~/.config/crawli-sa.json`
(`crawli-seo-mcp@fashion-crawler-c4ai.iam.gserviceaccount.com` — Full on GSC, Viewer on GA4)

**SEO/analytics tasks:** reach for `mcp__gsc__get_search_analytics` or `mcp__google-seo-mcp__gsc_search_analytics` first — don't ask the user to copy-paste data you can fetch directly.

**Supabase tasks:** use `mcp__claude_ai_Supabase__list_tables` before writing any migration, and `mcp__claude_ai_Supabase__execute_sql` to verify data rather than asking the user to check.

**Skills that pair with MCPs:**
- `/claude-seo:seo` or `/claude-seo:seo-audit` — full SEO audit, orchestrates the SEO MCP tools automatically
- `/claude-seo:seo-geo` — AEO/GEO audit, uses `mcp__geo-optimizer__*`
- `/claude-seo:seo-google` — CrUX + GSC + GA4 enriched report

## Critical rules

**1. Never hallucinate or assume.** Read files before editing. Verify paths and function names. For n8n and API integrations: never assume field names, output paths, or API response shapes. Always check `docs/core/PITFALLS.md` first — many wrong paths are already documented. The OpenAI n8n node output is `output[0].content[0].text`, not `message.content`.

**2. Test rigorously — every time.**
- `npm run dev:all` to start Next.js + Python sidecar
- Verify in a real browser; check Network tab and console
- `npx tsc --noEmit` must be clean
- Do not declare done based on type-checks alone

**3. Update docs after every session — the right doc, not just HANDOFF.**
- Did platform extraction change? → update `docs/core/PLATFORM_STATUS.md`
- Did you hit a new gotcha or fix one? → update `docs/core/PITFALLS.md`
- Did the architecture or data flow change? → update `docs/core/SYSTEM_DESIGN.md`
- Always update `HANDOFF.md` "Current state" and "Recent changes" sections

**What NOT to do:** Don't append a big "Latest change (date): ..." block to HANDOFF.md. The new system is current-state only. Put details in the relevant doc, put a one-line bullet in "Recent changes".

**Keep HANDOFF.md short.** It is read every session, so it is a context budget, not an archive. After adding your bullet, move any entry beyond the newest 5 into `docs/CHANGELOG.md` verbatim. Entries are one to three sentences: what changed and why. The details belong in PITFALLS/PLATFORM_STATUS/SYSTEM_DESIGN, not in a changelog paragraph.

**4. Do NOT modify:**
- `/api/` endpoints unless explicitly told (streaming NDJSON protocol is fragile)
- `/lib/` utilities without understanding the full call chain
- `crawl4ai-service/` Python code without reading docs/core/PLATFORM_STATUS.md first

## Project context

**Tech stack:** Next.js 16.2.6 App Router + React 19 + Tailwind v4 + TypeScript · Python sidecar (crawl4ai + Playwright) at `crawl4ai-service/` · Firecrawl for eBay search only (all other platforms use native Avenue A)

**Key files:**
- `HANDOFF.md` — current state hub
- `lib/types.ts` — platform sets (NATIVE_PLATFORMS, PLATFORM_DOMAINS, etc.)
- `lib/scraper.ts` — HTTP client for sidecar, SEARCH_PAGE_PLATFORMS set
- `crawl4ai-service/search_page_extractors.py` — Avenue A grid extractors
- `crawl4ai-service/main.py` — sidecar FastAPI app, wait_for configs, /expand-query
- `lib/parse.ts` — relevance filtering + alias-aware anchoring
- `lib/queryExpansion.ts` — brand alias map + primeExpansion
- `app/api/search/route.ts` — backend search endpoint

**Dev commands:** `npm run dev:all` · `npm run dev` · `npm run dev:sidecar`

## Social media content (TikTok carousels)

When the user asks for social/marketing posts, a new carousel batch, or work in `docs/marketing/`, do these BEFORE generating ideas or designing slides:

1. **Source fresh topics with `/last30days`** — scoped to the niche (secondhand fashion, vintage, resale). Cross-check against Supabase `content_history` (`posted = true` = already posted, never repeat).
2. **Run the `marketing-visual-diversity` skill** — runs `node docs/marketing/check-visual-diversity.js` to print what fonts/layout/placement to avoid. Each batch MUST differ from the last 1-2 on `font_pairing` AND `text_placement` AND `layout`.
3. **Use the `ui-ux-pro-max` skill** for design choices — `typography.csv` (57+ pairings, ships with the skill), `docs/marketing/visual-history.json` (what's used up).

**TikTok-only.** Default export: 4:5 (1080×1350). Keep headline/CTA out of bottom ~20% / right ~15% (TikTok UI). Cover = gpt-image-2 always.

**Obfuscate commercial intent: SUPERSEDED 2026-08-19, owner decision.** The old rule (no `thecrawli.com`, URL, "search Crawli", "download", or "link in bio" anywhere; Crawli teased only as a subtle final-slide aside) **no longer applies.** It produced 0 comments across 55 posts, failing its own stated KPI, and `COMPETITIVE_POSITIONING.md` §6d point 4 already instructed revisiting it. The August 2026 posts are founder-led and openly branded, so the rule was already dead in practice. Soft vs explicit CTA is now a **logged experiment** with a written kill criterion, not a standing rule. See `docs/planning/AUDIENCE_AND_HOOKS_PLAN.md` D2 and F6 before writing any caption or hook. Feature claims are still hard-gated by the §6b claim ledger and `docs/reference/B2B_FEATURE_TRUTH.md`.

**Journey Series posts are a different format — read `docs/marketing/journey-series/README.md` before starting one.** Real-person profile carousels (e.g. "make sure it follows the wording of the X one we did"), current default is an illustrated (AI-redrawn cartoon portrait) 14-slide format, pipeline lives on the user's Desktop at `~/Desktop/nano-banana-tests/<post-slug>/`, not in this repo. Explicit CTA + URL-adjacent phrasing is fine here (the obfuscation rule above does NOT apply to this format). Every journey post also gets a matching `content/blog/<slug>.md` and 3 draft X posts — see that doc's "Turning a post into a blog post + X posts" section for the exact steps.

## Common gotchas (quick reference — full list in docs/core/PITFALLS.md)

- **Streaming endpoints buffer in dev** — test `/api/search` with `curl -N`
- **CSS theming** — `[data-theme="dark"]` on `<html>`, not Tailwind `dark:`
- **SEARCH_PAGE_PLATFORMS is duplicated** — Python (`search_page_extractors.py`) AND TypeScript (`lib/scraper.ts`) — keep both in sync
- **RLS alone 503s** — every new Supabase table needs explicit `GRANT ... TO authenticated, service_role`
- **"tshirt" is a stopword** — platform titles write "t-shirt" which tokenizes differently; "tshirt" in queries is now a stopword in RELEVANCE_STOPWORDS
- **Brand alias matching is live** — `lib/queryExpansion.ts` handles bape/A Bathing Ape etc.; don't hand-add aliases to BRAND_ANCHOR_OVERRIDES
- **New/changed blog post or compare item? Run `node scripts/submit-bing.mjs <path...>`** — IndexNow alone doesn't get Bing to actually recrawl promptly on this domain; this requests priority reindexing. See `docs/reference/SERVER_REFERENCE.md` "Bing priority reindex"
- **Blog post titles get `· Crawli` auto-appended** — check the *rendered* `<title>` against Bing's ~60-char limit, not just the frontmatter string; keep frontmatter titles ≤51 chars

## Feature Implementation Workflow

For medium tasks (3-4 hours of estimated work), always follow this workflow:

1. **`/superpowers:brainstorming`** — explore requirements, propose 2-3 approaches, refine with user → outputs design spec
2. **`/superpowers:writing-plans`** — break spec into bite-sized tasks → outputs implementation plan
3. **`/superpowers:using-git-worktrees`** — create isolated feature branch (main stays clean)
4. **`/superpowers:subagent-driven-development`** — execute: implementer subagent per task + task reviewer gate (spec compliance + code quality) + fix loop if issues found
5. **`/superpowers:finishing-a-development-branch`** — merge back to main, verify
6. **Learning review** (after merge):
   - User writes 5-10 min explanation: what changed, why, how it works, key constraints/edge cases, what reviewer checked
   - Send summary to Claude
   - Claude corrects gaps only (not re-explain)
7. **Cleanup** (Claude-owned, after learning review):
   - Delete spec file: `docs/superpowers/specs/YYYY-MM-DD-*.md`
   - Delete plan file: `docs/superpowers/plans/YYYY-MM-DD-*.md`
   - Delete playwright artifacts: `.playwright-mcp/page-*.yml`, `.playwright-mcp/console-*.log`
   - Claude commits: `git add -A && git commit -m "cleanup: remove spec/plan artifacts after <feature> merged"`

**Key constraints:**
- Never start on main — always use a worktree
- Always spec → plan → execute (this order, every time)
- Learning review is mandatory (happens after merge, before cleanup)
- User owns commits/pushes and UI verification (manual, not Playwright by default)
- Claude cleans up scaffolding (specs/plans/artifacts) automatically after learning review

## Before starting any task

1. Read `HANDOFF.md` — what's the current state? Any open issues that affect my task?
2. Read the relevant doc (PLATFORM_STATUS / PITFALLS / SYSTEM_DESIGN) based on what I'm touching
3. What files do I actually need to modify?
4. What does success look like, and how will I verify it before saying done?

## Testing checklist

- [ ] `npx tsc --noEmit` clean
- [ ] Feature works in a real browser
- [ ] Light + dark mode correct
- [ ] No console errors; network requests succeed
- [ ] Behavior matches task description exactly
- [ ] Relevant doc updated (PLATFORM_STATUS / PITFALLS / SYSTEM_DESIGN)
- [ ] HANDOFF.md "Current state" + "Recent changes" updated
- [ ] Ports 3000 and 8000 freed before finishing (see `docs/reference/CLEANUP.md`)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
