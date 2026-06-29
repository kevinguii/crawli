# Claude Code Guidelines for This Project

**Read this file at the start of every session.**

## Documentation structure

The project uses four focused docs. Read what's relevant to your task — don't read all four every session.

| File | What's in it | Read when |
|---|---|---|
| `HANDOFF.md` | Current platform state, open issues, recent changes, env setup | Every session |
| `docs/PITFALLS.md` | Gotchas that will bite you if you don't know them | Before touching scraping, filtering, n8n, or Supabase |
| `docs/PLATFORM_STATUS.md` | Per-platform scraping method, selectors, status, open issues | Before touching any platform extraction |
| `docs/SYSTEM_DESIGN.md` | Architecture, search engine internals, cost model, data layer | When adding new features or understanding flow |

**Supporting docs:**
- `docs/SERVER_REFERENCE.md` — SSH, n8n workflow edits, deployment
- `docs/B2B_FEATURE_TRUTH.md` — what features actually exist (source of truth for landing copy)
- `docs/FIRECRAWL_PRICING.md` — Firecrawl credit costs
- `docs/marketing/POSTS_README.md` — carousel batch operation

## Critical rules

**1. Never hallucinate or assume.** Read files before editing. Verify paths and function names. For n8n and API integrations: never assume field names, output paths, or API response shapes. Always check `docs/PITFALLS.md` first — many wrong paths are already documented. The OpenAI n8n node output is `output[0].content[0].text`, not `message.content`.

**2. Test rigorously — every time.**
- `npm run dev:all` to start Next.js + Python sidecar
- Verify in a real browser; check Network tab and console
- `npx tsc --noEmit` must be clean
- Do not declare done based on type-checks alone

**3. Update docs after every session — the right doc, not just HANDOFF.**
- Did platform extraction change? → update `docs/PLATFORM_STATUS.md`
- Did you hit a new gotcha or fix one? → update `docs/PITFALLS.md`
- Did the architecture or data flow change? → update `docs/SYSTEM_DESIGN.md`
- Always update `HANDOFF.md` "Current state" and "Recent changes" sections

**What NOT to do:** Don't append a big "Latest change (date): ..." block to HANDOFF.md. The new system is current-state only. Put details in the relevant doc, put a one-line bullet in "Recent changes".

**4. Do NOT modify:**
- `/api/` endpoints unless explicitly told (streaming NDJSON protocol is fragile)
- `/lib/` utilities without understanding the full call chain
- `crawl4ai-service/` Python code without reading PLATFORM_STATUS.md first

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

**Obfuscate commercial intent:** No `thecrawli.com`, URL, "search Crawli", "download", or "link in bio" anywhere. Crawli teased only on final slide as subtle aside, worded differently each post, present in only some posts. Goal: comment inquiries, not clicks. See `docs/B2B_FEATURE_TRUTH.md` and live n8n brief `moMVEnr5L6kGgJTC`.

## Common gotchas (quick reference — full list in docs/PITFALLS.md)

- **Streaming endpoints buffer in dev** — test `/api/search` with `curl -N`
- **CSS theming** — `[data-theme="dark"]` on `<html>`, not Tailwind `dark:`
- **SEARCH_PAGE_PLATFORMS is duplicated** — Python (`search_page_extractors.py`) AND TypeScript (`lib/scraper.ts`) — keep both in sync
- **RLS alone 503s** — every new Supabase table needs explicit `GRANT ... TO authenticated, service_role`
- **"tshirt" is a stopword** — platform titles write "t-shirt" which tokenizes differently; "tshirt" in queries is now a stopword in RELEVANCE_STOPWORDS
- **Brand alias matching is live** — `lib/queryExpansion.ts` handles bape/A Bathing Ape etc.; don't hand-add aliases to BRAND_ANCHOR_OVERRIDES

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
