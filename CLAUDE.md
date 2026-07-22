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
- `docs/reference/SERVER_REFERENCE.md` — SSH, n8n workflow edits, deployment
- `docs/reference/B2B_FEATURE_TRUTH.md` — what features actually exist (source of truth for landing copy)
- `docs/reference/FIRECRAWL_PRICING.md` — Firecrawl credit costs
- `docs/marketing/POSTS_README.md` — carousel batch operation
- `docs/planning/GROWTH_PLAN.md` — distribution + conversion roadmap, SEO/AEO strategy

## Available MCP tools

These MCP servers are connected in this project. Use them instead of manual API calls or guessing.

| MCP | When to use |
|---|---|
| `mcp__gsc__*` | Fetch GSC search analytics, inspect URLs, list sitemaps, check indexing |
| `mcp__google-seo-mcp__*` | CrUX/Core Web Vitals, GA4 traffic, Lighthouse audits, SERP checks, schema validation, sitemap diffs |
| `mcp__geo-optimizer__*` | AEO/GEO audits — AI crawler access, llms.txt, citability, brand mention signals |
| `mcp__supabase__*` | Run SQL, apply migrations, list tables, check logs — always use over guessing schema |
| `mcp__n8n__*` | Search/trigger n8n workflows (content brief `moMVEnr5L6kGgJTC` is the TikTok carousel brief) |
| `mcp__playwright__*` | Browser automation — navigate, screenshot, fill forms. Use for UI verification |
| `mcp__claude_ai_Gmail__*` | Read/send email — only when user explicitly asks |
| `mcp__claude_ai_Google_Calendar__*` | Calendar — only when user explicitly asks |

**Service account** for GSC + GA4: `~/.config/crawli-sa.json`
(`crawli-seo-mcp@fashion-crawler-c4ai.iam.gserviceaccount.com` — Full on GSC, Viewer on GA4)

**SEO/analytics tasks:** reach for `mcp__gsc__get_search_analytics` or `mcp__google-seo-mcp__gsc_search_analytics` first — don't ask the user to copy-paste data you can fetch directly.

**Supabase tasks:** use `mcp__supabase__list_tables` before writing any migration, and `mcp__supabase__execute_sql` to verify data rather than asking the user to check.

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
2. **Run the `marketing-visual-diversity` skill** — runs `node check-visual-diversity.js` to print what fonts/layout/placement to avoid. Each batch MUST differ from the last 1-2 on `font_pairing` AND `text_placement` AND `layout`.
3. **Use the `ui-ux-pro-max` skill** for design choices — `typography.csv` (57+ pairings), `visual-history.json` (what's used up).

**TikTok-only.** Default export: 4:5 (1080×1350). Keep headline/CTA out of bottom ~20% / right ~15% (TikTok UI). Cover = gpt-image-2 always.

**Obfuscate commercial intent:** No `thecrawli.com`, URL, "search Crawli", "download", or "link in bio" anywhere. Crawli teased only on final slide as subtle aside, worded differently each post, present in only some posts. Goal: comment inquiries, not clicks. See `docs/reference/B2B_FEATURE_TRUTH.md` and live n8n brief `moMVEnr5L6kGgJTC`.

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
