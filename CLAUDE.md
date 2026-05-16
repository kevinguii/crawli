# Claude Code Guidelines for This Project

**Read this file at the start of every session.**

## Critical Rules

1. **Always read HANDOFF.md first** — it is the source of truth for:
   - Project architecture and tech stack
   - Known issues and gotchas
   - Platform-specific status (which ones work, which are broken)
   - Recent changes and what was tried
   - Testing procedures and verification checklists

2. **Never hallucinate or assume**
   - Read the actual file before editing it
   - Check file paths, line numbers, and function names by viewing files first
   - If you're unsure about something, state your assumption explicitly before proceeding
   - Ask clarifying questions rather than guessing

3. **Test rigorously — every time**
   - Run `npm run dev:all` to start both Next.js and the Python sidecar
   - Verify behavior in a real browser (not just TypeScript passing)
   - Test the specific scenario described in the task
   - If the task involves UI changes, take a screenshot or describe what you see
   - Check the Network tab / browser console for errors
   - Do not declare done based on type-checks alone

4. **Update HANDOFF.md after every session**
   - Add a new "Latest change" block at the very top with today's date
   - Include: what was done, what worked, what didn't work, why
   - Document any gotchas or tips that will help future sessions
   - Example:

**Latest change (2026-05-16):** Implemented platform card background colors.
 eBay uses 4-color stripe bar (red #E53238, blue #0064D2, yellow #F5AF02, green #86B817).
 Others use solid background + white text. Verified in light and dark mode.
 Gotcha: Vestiaire uses black text, not white. CSS variables work better than Tailwind classes for theme switching.

 ## Project Context

**Tech stack:**
- Next.js 16.2.6 App Router + React 19 + Tailwind v4 + TypeScript
- Python sidecar (crawl4ai + Playwright) at `crawl4ai-service/`
- Firecrawl for search only (not scraping)

**Key files:**
- `HANDOFF.md` — project status, architecture, known issues
- `app/components/` — React components
- `app/api/search/route.ts` — backend search endpoint
- `lib/scraper.ts` — HTTP client for Python sidecar
- `lib/types.ts` — TypeScript types

**Development commands:**
- `npm run dev:all` — starts both Next.js (port 3000) and sidecar (port 8000) together
- `npm run dev` — Next.js only
- `npm run dev:sidecar` — Python sidecar only

**Do NOT modify:**
- `/api/` endpoints unless explicitly told (the streaming NDJSON protocol is fragile)
- `/lib/` utilities without understanding the full call chain
- `crawl4ai-service/` Python code (backend is in a separate session context)

## Testing Checklist Template

Before declaring done, verify:

- [ ] Code runs without TypeScript errors (`npm run dev:all`)
- [ ] Feature works in a real browser (not just dev server output)
- [ ] Light mode works correctly
- [ ] Dark mode works correctly
- [ ] No console errors (check browser DevTools)
- [ ] Network requests succeed (check Network tab)
- [ ] Behavior matches the task description exactly
- [ ] HANDOFF.md updated with status and tips

## Common Gotchas

- **Streaming endpoints buffer in dev mode** — if you're working on `/api/search` streaming, test with `curl -N` first to bypass dev proxy buffering
- **CSS variables for theming** — use `[data-theme="dark"]` on `<html>`, not Tailwind's `dark:` variant
- **Platform colors are specific** — verify hex codes match brand colors, not approximations
- **eBay is broken** — known issue, don't waste time debugging. Document if it behaves unexpectedly.
- **Vestiaire URL discovery broken** — search works, scraping works, but URL-finding is blocked. Don't try to fix.

## Questions to Ask Yourself Before Starting

1. Have I read HANDOFF.md fully?
2. Do I understand the current architecture?
3. Are there known issues related to what I'm about to touch?
4. What files do I actually need to modify?
5. What does success look like (what am I testing for)?
6. How will I verify this works before saying it's done?

If you can't answer these, stop and read HANDOFF.md again.