# Claude Code Guidelines for This Project

**Read this file at the start of every session.**

## Critical Rules

1. **Always read HANDOFF.md first** — source of truth for architecture, known issues, platform status, recent changes, and testing procedures.

2. **Never hallucinate or assume** — read files before editing; verify paths and function names; state assumptions explicitly; ask rather than guess.

   **For n8n workflows and API integrations specifically:** never assume field names, output paths, node parameter keys, or API response shapes. These change between versions and are wrong more often than not. Always:
   - Search the web or fetch official docs to verify the real field name
   - Use MCP tools (n8n MCP, Zernio docs, etc.) to inspect live data
   - Reference the gotchas already documented in AGENT_PLAN.md (e.g. OpenAI node output is `output[0].content[0].text`, not `message.content`)
   - If unsure about any variable name or API shape, say so and look it up — do not guess and move on

3. **Test rigorously — every time**
   - `npm run dev:all` to start Next.js + Python sidecar
   - Verify in a real browser; check Network tab and console for errors
   - Do not declare done based on type-checks alone

4. **Update HANDOFF.md after every session — full sync, not just append**
   - Add a "Latest change" block at the top with today's date (required)
   - Include: what was done, what worked, what didn't, why
   - **CRITICAL:** also update §2–§7 reference sections to reflect new reality — don't leave stale info below a current top
   - Check if any lower-section assumptions are now wrong (e.g. "no auth yet")
   - Example entry: `**Latest change (2026-05-16):** Implemented platform card colors. eBay: 4-color stripe. Others: solid bg + white text. Gotcha: Vestiaire uses black text. CSS variables > Tailwind classes for theme switching.`

## Project Context

**Tech stack:** Next.js 16.2.6 App Router + React 19 + Tailwind v4 + TypeScript · Python sidecar (crawl4ai + Playwright) at `crawl4ai-service/` · Firecrawl for search only

**Key files:**
- `HANDOFF.md` — project status, architecture, known issues
- `app/components/` — React components
- `app/api/search/route.ts` — backend search endpoint
- `lib/scraper.ts` — HTTP client for Python sidecar
- `lib/types.ts` — TypeScript types

**Dev commands:** `npm run dev:all` (Next.js :3000 + sidecar :8000) · `npm run dev` (Next.js only) · `npm run dev:sidecar` (sidecar only)

**Do NOT modify:**
- `/api/` endpoints unless explicitly told (streaming NDJSON protocol is fragile)
- `/lib/` utilities without understanding the full call chain
- `crawl4ai-service/` Python code (separate session context)

## Testing Checklist

Before declaring done:
- [ ] No TypeScript errors (`npm run dev:all`)
- [ ] Feature works in a real browser
- [ ] Light + dark mode correct
- [ ] No console errors; network requests succeed
- [ ] Behavior matches task description exactly
- [ ] HANDOFF.md updated

## Common Gotchas

- **Streaming endpoints buffer in dev mode** — test `/api/search` streaming with `curl -N` to bypass dev proxy buffering
- **CSS theming** — use `[data-theme="dark"]` on `<html>`, not Tailwind `dark:` variant
- **Platform colors are specific** — verify exact hex codes, not approximations
- **eBay is broken** — known issue, don't debug; document unexpected behavior
- **Vestiaire URL discovery broken** — search + scraping work; URL-finding is blocked. Don't fix.
- **ThredUp brand queries return garbage (§7 L)** — ThredUp's catalog is mass-market basics; luxury/streetwear brands like BAPE are absent. ThredUp's fuzzy search falls back to matching on descriptor words ("shirt", "hoodie") when the brand isn't in inventory. Combined with `titleMatchesQuery` requiring only 1 of N tokens, irrelevant results slip through. Fix: use ThredUp's `brand` JSON-LD field (already extracted) to require brand match. See §7 L in HANDOFF.md. Do NOT fix without user approval — it's a multi-file change touching the extractor + parse step.

## Before Starting

1. Have I read HANDOFF.md fully?
2. Do I understand the current architecture?
3. Are there known issues related to this task?
4. What files do I actually need to modify?
5. What does success look like?
6. How will I verify before saying it's done?

If you can't answer these, stop and read HANDOFF.md again.
