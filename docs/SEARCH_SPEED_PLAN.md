# Search Speed & Result-Count Improvement Plan

**Status:** Active scratchpad / continuation prompt for a new chat.
**Started:** 2026-05-24 (Phase 1 shipped); paused 2026-05-27 while landing/alerts/saves work happened.
**Owner:** Kevin.

This document is the **continuation prompt** for the search-speed work. The next chat should read this top-to-bottom, then read HANDOFF.md (top + §6 + §7), then resume from "Where we left off" below.

---

## TL;DR

We're addressing two faults observed during a live search of `fear of god essentials hoodie`, size M, color gray:

1. **Too few results** — Grailed returned only 1 listing in some cases (now mitigated; see Phase 1).
2. **Too slow** — full 8-platform search takes ~3 min 15s end-to-end on local M1 (8 GB).

Work is **iterative, fact-only, no assumptions**. Each phase ships independently, gets verified live, then we decide on the next.

---

## What's already shipped (Phase 1 — done 2026-05-24)

Two small edits to stop over-narrowing the search-engine query:

1. **`lib/filterOptions.ts`** — removed `condition` from `filtersToQuerySuffix()`. The condition filter never had a server-side post-filter; it was only ever a keyword stuffed into the upstream search query, which was hurting recall for marginal benefit on resale.
2. **`app/components/FilterPanel.tsx`** — removed the Condition `FilterDropdown` from the UI; removed unused `CONDITION_OPTIONS` import + re-export.

**What was deliberately NOT removed (backwards compat):**
- `CONDITION_OPTIONS` constant in [lib/filterOptions.ts](../lib/filterOptions.ts) (still exported, just unused by UI).
- `FilterState.condition` field on the type (cached searches & in-flight serialized FilterState payloads still parse).
- `filtersSchema.condition` in `app/api/search/route.ts` (still accepts the field, just doesn't do anything with it).

If we want a full purge later, those are the targets. Not blocking.

**Verified live (2026-05-24):** Same FOG essentials hoodie search. Grailed: 40 listings via search-page extraction (it's in `SEARCH_PAGE_PLATFORMS` now — see HANDOFF 2026-05-22). Depop 20→10, Poshmark 20→15, Mercari 20→13, Vinted 20→16, eBay 20→19, Vestiaire 20→5, ThredUp 100. Result counts are healthy; the "1 result" problem is resolved.

---

## Where we left off

Phase 1 fixed the result-count problem. **Speed is the remaining issue** (~3 min 15s for a full 8-platform search on local M1).

Root causes identified from live log analysis (2026-05-24 search; full transcript in user's terminal, not preserved here):

| Cause | Evidence | Lever |
|---|---|---|
| **`delay_before_return_html=5.0s` on every per-listing render** | [crawl4ai-service/main.py:643](../crawl4ai-service/main.py#L643). ~50 renders × 5s = ~250s of wait, parallelized across 6 slots = ~42s of pure wait per search. | Find the per-platform floor via a probe script, tune down. |
| **Render-semaphore saturation** | `in_flight=6 pool=1/1` shown constantly in logs. `SIDECAR_MAX_CONCURRENT_RENDERS=6` (local default) / `8` (prod CCX13). | Raise on prod first (8GB box can probably take 10); local needs measurement. |
| **Per-platform scrape concurrency hardcoded to 2** | [app/api/search/route.ts:111](../app/api/search/route.ts#L111) — `allSettledWithConcurrency(scrapers, 2)`. | Make env-tunable; but **only useful after** raising the global render semaphore. With prod's `RENDERS=8 / CONC=4`, 4 platforms × 2 listings = 8 = already saturating. |
| **Vinted/eBay tail-latency outliers** | One Vinted fetch at 48s; eBay Akamai blocks cause full retry rounds. | Per-render timeout (e.g. 25s, after probing the latency distribution). |
| **eBay Akamai → full retry → LLM fallback** | 3 of 4 eBay URLs blocked; each costs ~10s blocked + ~10s retry + ~3s LLM fallback. | Skip retry on Akamai blocks. |
| **Some Tier 1 misses → LLM fallback** | Poshmark missed twice, Vestiaire missed once in the test search. Each LLM call ≈ 3–6s. | Tighten Tier 1 extractors per platform (separate work). |

---

## The plan, in priority order

**Updated order (2026-05-27):** 2a → 2d → 2e → 2b → 2c. Per-render time wins (2a/2d/2e) come first; capacity bumps (2b/2c) only make sense once we know what each render actually costs.

### Phase 2a — Probe `delay_before_return_html` floor per platform (**next**)

**Goal:** find the minimum delay where Tier 1 extractors still hit 100% (or close) on a known-good set of URLs.

**What to build:** a one-off probe script at `crawl4ai-service/scripts/delay_probe.py` (don't permanently add to the codebase) that:
1. Takes a small fixed list of known-good listing URLs per platform (5 each, recent and live — fetch from a sample search if needed).
2. For each URL, runs `/scrape` at delays of `5.0, 3.0, 2.0, 1.0` seconds and records: (a) HTTP success, (b) Tier 1 hit/miss, (c) extracted price, (d) total time.
3. Outputs a per-platform table: minimum delay where Tier 1 still hits 5/5.

**Rules:**
- Don't guess at the new value before running the probe. The user has explicitly said: "remember don't change anything based off assumptions, change only based off testing."
- Don't change `main.py` until the probe data is in hand.
- The Grailed search-page already runs at 2.0s ([main.py:667](../crawl4ai-service/main.py#L667)) and works — that's our existence proof that 2.0s is achievable for some workloads.

**Expected outcome:** plausibly Depop/Mercari/Vinted can drop to 2.0–3.0s; Poshmark may need to stay at 5–6s due to its known redirect-mid-load issue ([HANDOFF gotcha 23](../HANDOFF.md)).

**Risk:** Lowering delay below the JS-hydration point causes Tier 1 to miss → LLM fallback fires → cost goes up and accuracy may drop. That's why we probe first.

### Phase 2b — Bump `SIDECAR_MAX_CONCURRENT_RENDERS` on prod (cheap config change)

**Deferred** — do this only after 2a + 2d + 2e have been shipped. The semaphore may not be the bottleneck once per-render time drops.

**Prod box:** Hetzner CCX13, 2 vCPU, 8 GB RAM. Per SCALING.md and HANDOFF, current tuning is `RENDERS=8, POOL=1, CONC=4`.

**Hypothesis:** with `POOL=1` (single Chromium process), the bottleneck is more likely RAM than CPU at this scale. Bumping `RENDERS` from 8 → 10 may give headroom; 8 → 12 is risky on 2 vCPU. **Measure don't assume.**

**Test plan (prod, NOT local):**
1. Set `SIDECAR_MAX_CONCURRENT_RENDERS=10` in prod `.env`, restart sidecar.
2. Hit `/api/health` to confirm pool is healthy.
3. Run a real 8-platform search via the prod URL. Watch sidecar logs for `in_flight=N pool=1/1` lines. If `in_flight` plateaus at 10 without errors and Chromium memory stays under 4 GB → keep. If errors / OOM → revert.
4. Try `RENDERS=12` only if 10 is clearly stable.

**For local M1 (8 GB):** likely fine to also go 6 → 8, but verify with Activity Monitor that the M1 isn't swapping under load.

**User to apply via `.env`; do not commit defaults.** Per the existing `.env` hygiene rule in HANDOFF: defaults belong in code; `.env` only carries machine-specific overrides.

**How to verify before deciding to bump:**

Capture a baseline during a real 8-platform search on prod — you need to know whether the box is CPU-bound, RAM-bound, or has headroom.

1. SSH to prod, `htop` in one pane.
2. `docker stats` (or `ps aux --sort=-%mem | head` if running bare) in a second pane — watch sidecar RSS + CPU.
3. `tail -f` the sidecar log in a third pane — watch the `in_flight=N pool=1/1` lines.
4. Fire a live 8-platform search from the UI.

Decision table:

| Reading during search | Interpretation |
|---|---|
| `in_flight=8` constantly, CPU < 80%, RAM < 70% | Semaphore is the bottleneck → bump helps. Try 10, re-measure. |
| `in_flight=8`, CPU pegged ~200% (both cores) | CPU-bound → bump just queues. Skip 2b. |
| `in_flight=8`, RAM near 7 GB or swap active | RAM-bound → bump risks OOM. Skip 2b. |
| `in_flight` < 8 most of the time | Semaphore isn't the bottleneck. Skip 2b, focus elsewhere. |

**Acceptance criteria for keeping the bump:** wallclock drops ≥10%, no OOM, fetch p95 doesn't regress.

**Revert criteria:** sidecar restarts, Chromium OOM-killed, or fetch p95 increases (CPU contention).

### Phase 2c — Per-platform concurrency env knob

**Deferred** — do this only after 2b. The value bump is meaningless until the global render semaphore has headroom.

**Current:** hardcoded `2` at [app/api/search/route.ts:111](../app/api/search/route.ts#L111).

**Action:** introduce `SCRAPE_PLATFORM_CONCURRENCY` env var with default `2` (preserves current behavior). Bumping to 3 is only useful after Phase 2b raises the global cap, otherwise it just enqueues.

**Risk:** very low.

**How to verify:**

The env-knob code change itself is a no-op (default `2` preserves behavior) — safe to land anytime.

The *value bump* is what needs verification, and it's gated on 2b:

1. Confirm 2b actually raised the global cap (sidecar log shows `in_flight` plateauing higher than 8 during a search).
2. Set `SCRAPE_PLATFORM_CONCURRENCY=3` in prod `.env`, restart Next.
3. Re-run a real 8-platform search; compare wallclock + the `in_flight=N` log line against the post-2b baseline.
4. **Keep** if `in_flight` plateaus at the new ceiling AND wallclock drops. **Revert** if `in_flight` is unchanged (global cap still the bottleneck) or wallclock doesn't move.

### Phase 2d — Per-render timeout

**Goal:** stop the long tail (Vinted 48s, eBay retries) from holding a slot.

**Approach:**
1. Add structured timing logging (already partly there — `[FETCH]... ⏱: Ns` lines exist).
2. Probe: run ~50 searches in production via the smoke test or curl, dump fetch times to a CSV, compute p50/p90/p95/p99 per platform.
3. Pick a timeout that drops the p99 outliers without truncating real p95.
4. Implement as `asyncio.wait_for` around `crawler.arun(...)` inside `_arun_with_retry`. On timeout: log + return None so the caller skips that listing (existing code already handles None gracefully).

**Risk:** medium — wrong threshold drops real results. Accuracy-first means probe before code.

### Phase 2e — Skip eBay Akamai retry round

**Observation:** when eBay returns "Akamai block (Reference #)", retrying the same URL with the same fingerprint will almost certainly block again. Currently we burn ~10s of retry + ~3s of LLM fallback per blocked URL for no gain.

**Action:** in `structured_extractors.py` (or wherever the Akamai pattern is detected), short-circuit on this specific error — mark the listing as unscrapable, return None immediately, skip retry and LLM.

**Risk:** low — already failing today.

### Phase 3 — Migrate Mercari & eBay to search-page extraction

**Current `SEARCH_PAGE_PLATFORMS`:** `{thredup, realreal, grailed, mercari}` (Mercari added 2026-05-27 — see HANDOFF latest-change). Source in both [crawl4ai-service/search_page_extractors.py](../crawl4ai-service/search_page_extractors.py) and [lib/scraper.ts:12](../lib/scraper.ts#L12).

**Priority order by ROI** (per user's instruction — start with most expensive on URL discovery):

1. ~~**Mercari**~~ — **DONE 2026-05-27.** 51 listings per search (vs ~13 on old firecrawl path), 1 FC call eliminated, ~70–90% latency drop estimated. See HANDOFF top latest-change block for survey notes + gotchas.
2. **eBay** (next) — `firecrawl-only` ([lib/firecrawl.ts:79](../lib/firecrawl.ts#L79)). Akamai-hostile so the search page itself may be guarded. Probe before committing — start with `https://www.ebay.com/sch/i.html?_nkw=<query>` (or whatever the canonical search URL is) and verify the render comes back clean.
3. Depop, Poshmark, Vinted, Vestiaire — lower priority (already Brave-cheap on URL discovery; the win is latency only).

**For each platform, follow the C1/Grailed precedent (HANDOFF 2026-05-22 §M):**
1. **Survey first.** Hit the platform's search URL in a real browser. Open DevTools → check whether listing data is in:
   - Initial SSR HTML (best — like ThredUp's JSON-LD)
   - `__NEXT_DATA__` (good — like Mercari item pages)
   - Hydrated DOM after JS runs (workable — like Grailed; needs `wait_for`)
2. **Run an `extract_*_search.py` probe** that fetches the search URL via the sidecar and dumps the relevant blob. Confirm we can extract URL + title + price + image + size + condition per card.
3. **Write the extractor** in `search_page_extractors.py`. Follow the existing `extract_grailed_grid` / `extract_thredup_grid` shape — same return contract.
4. **Add `<platform>_search_url(query)`** helper alongside.
5. **Update `SEARCH_PAGE_PLATFORMS`** in both Python and TypeScript.
6. **Tune `_build_run_cfg(search_page=True)` for the platform** if it needs `wait_for` or a different delay.
7. **Verify live:** count match, prices match a manual browser visit, sold listings filtered correctly.
8. **Leave `PLATFORM_STRATEGY` entry in place** as a fallback (inert when `SEARCH_PAGE_PLATFORMS` wins, per Grailed precedent).

**On user's instruction to bump result count for fast platforms:** ThredUp already pulls 100 per render; Grailed pulls up to 40 per render. The route caps the user-facing slice; if we want to surface more, raise the slice in [route.ts:96](../app/api/search/route.ts#L96) (currently `.slice(0, 10)` on the search-page branch) and [route.ts:106](../app/api/search/route.ts#L106) (for the non-search-page branch). For search-page platforms the cost is zero so this is a pure UX call.

---

## Hard rules for whoever picks this up

These are explicit user preferences, repeated multiple times. Do not violate.

1. **Facts, not assumptions.** No tuning a parameter "because it feels low." Probe → measure → tune. If you don't have data, build the probe.
2. **Accuracy first, then speed.** A faster search that returns wrong prices is a regression.
3. **Iterative, small changes.** Phase 1 was 2 edits totalling ~10 lines. Phase 2a is one probe script + one config edit. Don't bundle.
4. **Always read HANDOFF.md before touching anything.** Project rule.
5. **Full HANDOFF sync at end of session** — not just append, update §2–§7 reference sections to match new reality. The CLAUDE.md project instructions enforce this.
6. **Don't add config defaults to `.env`.** Defaults go in code; `.env` only holds per-machine overrides.
7. **No backwards-compat shims when you can just change the code** — but **do** preserve type-field/cache-key backwards compat where stale serialized state could exist (the Phase 1 condition removal is the template).

---

## Reference: current env tuning by environment

| Var | Local M1 (8 GB) | Prod CCX13 (2 vCPU, 8 GB) | Notes |
|---|---|---|---|
| `SIDECAR_BROWSER_POOL_SIZE` | 1 (default) | 1 | Don't raise on CCX13 — only 2 vCPU |
| `SIDECAR_MAX_CONCURRENT_RENDERS` | 6 (default) | 8 | Phase 2b candidate to bump |
| `SEARCH_PLATFORM_CONCURRENCY` | 3 (default) | 4 | |
| `WATCHLIST_REFRESH_CONCURRENCY` | 4 (default) | 4 | |
| `SEARCH_PROVIDER` | hybrid | hybrid | |
| `BRAVE_HYBRID_THRESHOLD` | 5 (default) | 5 (default) | |

Source: [HANDOFF.md L615-L619](../HANDOFF.md), [SCALING.md L237-L253](../SCALING.md), [.env.example](../.env.example).

---

## How to resume in a new chat

Paste this into the new chat:

> I'm continuing the search-speed work. Read `docs/SEARCH_SPEED_PLAN.md` top-to-bottom, then read HANDOFF.md (top latest-change blocks + §3 Architecture + §6 platform status + §7 open problems). Confirm you understand where we are, then start on Phase 2a: write a per-platform `delay_before_return_html` probe script as described in the doc. **Do not change `main.py` defaults until probe data is in hand.** Run the probe against 5 known-good URLs per platform, report results, then we decide.
