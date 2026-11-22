# Archive

Old / unused files kept around in case they're useful for reference. **Nothing here is wired into the running app or sidecar** — moving these out of their original locations had no behavioral effect.

If a file here ends up being genuinely needed again, `git log --follow` from this directory will show where it used to live.

## What's here and why

### `proxy.ts`
Supabase auth middleware. Next.js only auto-runs a file named exactly `middleware.ts`, so this file (named `proxy.ts` with `export function proxy`) was never actually executed by Next.js. Auth in the app works via `app/auth/`, `SavesProvider`, and the Supabase client in `lib/supabase/` — independent of this file. Looks like an abandoned mid-implementation rename (commit `ca6ee07`, "still updating"). Kept here in case the original auth-middleware intent comes back.

### `python/`
Pre-sidecar experimentation: `test.ipynb` and `test_scrape.py` from May 13, before the FastAPI sidecar at `crawl4ai-service/` existed. Zero references anywhere in the project.

### `crawl4ai-debug/`
Ad-hoc debug scripts from sidecar development:
- `debug_ebay.py` — one-off eBay anti-bot probe
- `debug_probe.py` — generic HTML dumper

Not imported by `main.py` or anything else.

### `scripts/`
One-shot diagnostic / legacy scripts:

| File | Why archived |
|---|---|
| `debug-platforms.mjs` | Zero references anywhere |
| `test-scrape.mjs`, `test-scrape-2.mjs`, `test-vestiaire.mjs` | Zero references; superseded by `scripts/test-all-platforms.mjs` |
| `discover-thredup.mjs` | docs/HANDOFF.md flagged "safe to delete" — one-off Firecrawl probe |
| `diagnose-parallel.mjs` | docs/HANDOFF.md flagged "legacy; avoid" — reproduces an old timeout bug |
| `diagnose-scrape.mjs` | docs/HANDOFF.md flagged "legacy, uses old Firecrawl scraping; avoid" |
| `measure_tokens.py` | `scripts/README_TOKENS.md` flagged "superseded; kept for backwards-compat" — replaced by `token_cost_analysis.py` |

### Still active in `scripts/` (not archived)
For reference, these are the scripts that remained in their original location because they are still useful or referenced:
- `diagnose-counts.mjs`, `diagnose-grailed.mjs`, `test-all-platforms.mjs` — referenced in docs/HANDOFF.md as active diagnostic tools
- `engine_bakeoff.py`, `limit_sweep.py`, `token_cost_analysis.py` — current cost/quality measurement toolkit
- `README_TOKENS.md`, `bakeoff_fixture.json`, `bakeoff_results.csv`, `limit_sweep_gucci_bag.json` — companion docs and fixtures
