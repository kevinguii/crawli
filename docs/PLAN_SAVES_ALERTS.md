# Saves + Search Alerts Restructure — Implementation Plan

> **Status:** planning complete, not yet started.
> **Created:** 2026-05-25.
> **Owner:** delete this file when all phases ship and the work is reflected in HANDOFF.md.
> **Why this exists:** the conversation that produced this plan is long; saving it
> ensures the next session can pick up at Phase 1 without re-deciding anything.

---

## Background

Today, **Collections** (saves) and **Watchlist** live as tabs inside the Profile
page. Two problems:

1. **Discoverability** — they're buried; new users don't know they exist.
2. **Mental model overlap** — users find "Collections" vs "Watchlist" hard to
   differentiate. Both involve "saving."

A third, more valuable feature is missing: **Search Alerts** (StreetEasy-style
saved searches that notify on new matches). This is the killer feature for a
cross-platform aggregator — single-platform marketplaces can't offer it, but
Crawli can.

---

## Locked-in decisions (made 2026-05-25)

| Decision | Choice | Reasoning |
|---|---|---|
| **Saves location** | Move to dedicated `/saves` page; remove from Profile | Discoverability via top-nav ♡ icon |
| **Folders for Saves** | Keep them | Infrastructure exists, default-folder pattern makes complexity invisible to non-power-users |
| **Folder URL routing** | URL-driven (`/saves/[folderId]`) | Shareable links, back-button works, refresh-stable; zero DB change |
| **Alerts location** | New `/alerts` page with two tabs: Tracked items + Search alerts | Tracked items = current watchlist; Search alerts = new feature |
| **Profile page direction** | Dashboard (stats + recent searches + mini widget cards) | Replaces empty space left by Saves/Watchlist tabs leaving |
| **Search Alert notifications (first ship)** | Email digest + in-app toast (Realtime) | Email = cheap and reliable; toast for active users; Web Push deferred |
| **Alert execution** | Reuse background-searches worker from `docs/BACKGROUND_SEARCHES_PLAN.md` | Build worker once, use for on-demand + scheduled |
| **Cron home** | Hetzner systemd timer hitting local Next.js route | No external dependency; matches existing sidecar setup |
| **Tier caps** | Decide after Phase 1+2 ship; design schema so caps live in `profiles` columns | Real usage data > guessing |
| **Third pricing tier** | Not in scope of this plan | Separate business decision; revisit post-launch |

---

## Phase 1 — Saves becomes `/saves` page

**Effort:** ~half day. **Risk:** low. **Prereq:** none.

### Routes
| Route | File | Notes |
|---|---|---|
| `/saves` | new `app/(protected)/saves/page.tsx` | All-items view (current "My Collection") |
| `/saves/[folderId]` | new `app/(protected)/saves/[folderId]/page.tsx` | Folder-scoped view |
| `/profile?tab=saves` | edit `app/(protected)/profile/page.tsx` | Redirect to `/saves` server-side |

### UI changes
- Move `SavesTab.tsx` content into the new pages. Folder navigation state becomes URL-driven via `useRouter().push('/saves/' + folderId)` instead of `setCardViewFolderId(...)`.
- Add description copy at top of page: *"Items you've hearted. Organize into collections to find them later."* (smaller copy under the page header)
- Empty state copy stays as it is: "Heart anything to save it."
- Top-nav ♡ icon → `/saves`. Lives in the existing nav row next to the avatar / subscription badge.

### Files touched
- new: `app/(protected)/saves/page.tsx`, `app/(protected)/saves/[folderId]/page.tsx`
- edit: `app/components/profile/ProfileTabsClient.tsx` — remove "saves" tab from `TABS`; default to "watchlist" until Phase 3 moves that too
- edit: `app/(protected)/profile/page.tsx` — server-side redirect for `?tab=saves`
- edit: `app/components/AuthButton.tsx` (or whichever component renders the top-nav row) — add ♡ icon
- move: `app/components/profile/SavesTab.tsx` → `app/components/saves/SavesPage.tsx` (rename, reuse the logic)

### Things NOT changing
- `saves` table schema (no DB migration)
- `collection_folders` table schema (no DB migration)
- `/api/saves/*` routes (no API changes)
- `SavesProvider` context (still global; still used by heart buttons everywhere)
- Heart button behavior on listings (still defaults to "My Collection")

### Verification
- [ ] Heart a listing from search results → still saves to default folder, toast still works
- [ ] Navigate to `/saves` directly → shows all saved items
- [ ] Click into a custom folder → URL changes to `/saves/<uuid>`, browser back button returns to all-items view
- [ ] Hit `/profile?tab=saves` → redirected to `/saves` cleanly
- [ ] ♡ icon visible in nav on protected pages
- [ ] Light mode + dark mode both fine
- [ ] `npx tsc --noEmit` clean

---

## Phase 2 — Profile page becomes a dashboard

**Effort:** ~half day. **Risk:** low. **Prereq:** Phase 1 (so Saves is already moved out).

### What goes on the page

Top to bottom:

1. **Profile header** — existing component (avatar, display name, edit profile button). Unchanged behavior. Slightly larger avatar treatment optional.
2. **Activity stats strip** — three numbers in a row: searches this month, items saved (total), platforms searched. Server-fetched on page load.
3. **Recent searches widget** — last 10 entries from `search_history` table. Each row: query + relative timestamp ("3 days ago"). Click → re-runs the search. (`search_history` already exists; this is a new surface for it.)
4. **Top brands/platforms widget** — small card. Aggregated from `saves` table: top 3 platforms by save count, top 5 brands if extractable.
5. **Mini cards: latest saves + latest watched items** — iPhone-widget style. Two small cards side by side: "Recently saved" (4 thumbnails of last 4 saves, click → `/saves`) and "Recently watched" (4 thumbnails of last 4 watchlist items, click → `/alerts`).

### What's NOT going on the page
- Billing / quota info → stays in Settings (already there, no point duplicating)
- Bio editing → stays inside Edit Profile modal (current pattern works)
- Public-profile / social features → deferred until core is solid

### Data model
- No schema changes. Stats are aggregated from existing tables on each page load (cheap: counts only).
- For performance, consider caching the aggregations briefly if the page feels slow — but premature for first ship.

### Files touched
- edit: `app/(protected)/profile/page.tsx` — replace tabs with dashboard composition
- new: `app/components/profile/StatsStrip.tsx`
- new: `app/components/profile/RecentSearchesWidget.tsx`
- new: `app/components/profile/TopBrandsWidget.tsx`
- new: `app/components/profile/MiniSavesCard.tsx`
- new: `app/components/profile/MiniWatchlistCard.tsx`
- new: `app/api/profile/stats/route.ts` — returns `{searchesThisMonth, savesTotal, platformsSearched}`
- existing API used: `/api/search-history`, `/api/saves`, `/api/watchlist`

### Verification
- [ ] Profile page renders all five sections in light + dark mode
- [ ] Stats numbers match what's actually in the DB for the test user
- [ ] Click recent search → search re-runs with the same query
- [ ] Click mini saves card → routes to `/saves`
- [ ] Click mini watchlist card → routes to `/alerts` (will 404 until Phase 4 ships — accept that gap, or temporarily route to `/profile?tab=watchlist` until then)

---

## Phase 3 — Background searches infrastructure (Phase 0 + 1 from existing plan)

**Effort:** ~1.5 days. **Risk:** medium (touches core search flow). **Prereq:** none.

This is **prereq for Phase 4**. Doing it in this order avoids building the worker twice.

Follow [docs/BACKGROUND_SEARCHES_PLAN.md](BACKGROUND_SEARCHES_PLAN.md) Phases 0 + 1 verbatim:

- Phase 0: `search_jobs` table + extract `runSearchJob` worker from streaming route
- Phase 1: `POST /api/search/background` route + opt-in toggle in SearchForm + Realtime toast

**No deviations** from the existing plan. That doc is the source of truth for this phase. When Phase 3 of *this* plan completes, mark Phase 0+1 of `BACKGROUND_SEARCHES_PLAN.md` as done in HANDOFF.

---

## Phase 4 — `/alerts` page (Tracked items + Search Alerts)

**Effort:** ~2 days. **Risk:** medium-high (new feature, payments-adjacent). **Prereq:** Phase 3.

### Page structure
- `/alerts` route, server component, two-tab client component
- Tab 1: **Tracked items** — current watchlist UI moved here verbatim
- Tab 2: **Search alerts** — new

### Tracked items tab
- Direct move of `WatchlistTab.tsx` content into a new component under the alerts page
- Existing API (`/api/watchlist/*`) unchanged
- Redirect `/profile?tab=watchlist` → `/alerts?tab=tracked`

### Search alerts tab — schema

```sql
CREATE TABLE public.saved_searches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query                text NOT NULL,
  platforms            text[] NOT NULL,
  filters              jsonb,                     -- size, price range, condition, color, category
  cadence_hours        int NOT NULL DEFAULT 24,   -- how often to re-run
  last_run_at          timestamptz,
  next_run_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_urls       text[],                    -- bounded; see "Diffing" below
  unread_match_count   int NOT NULL DEFAULT 0,
  paused               boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_searches_user_idx ON public.saved_searches(user_id);
CREATE INDEX saved_searches_due_idx ON public.saved_searches(next_run_at) WHERE NOT paused;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own searches" ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own" ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own" ON public.saved_searches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own" ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
```

Tier caps live in `profiles` (add columns when ready):
```sql
ALTER TABLE public.profiles
  ADD COLUMN max_saved_searches int DEFAULT 1,        -- 1 for free, 5 for pro (tune later)
  ADD COLUMN min_alert_cadence_hours int DEFAULT 24;  -- 24 for free, 6 for pro
```

These default to free-tier values. The Stripe webhook (in `app/api/webhooks/stripe/route.ts`) sets them appropriately on `subscription.created/updated`.

### Diffing logic (the ambiguous bit, expanded)

**Problem:** how do we know which listings are "new" since the last run?

**Solution:** each `saved_searches` row stores `last_seen_urls` — an array of listing URLs that have been seen in past runs. On each run:

1. Execute the search (via the background worker — same `runSearchJob` machinery)
2. Collect all result URLs across platforms
3. Compute `new_urls = current_urls - last_seen_urls`
4. If `new_urls.length > 0`:
   - Increment `unread_match_count` by `new_urls.length`
   - Send notification (email + Realtime broadcast)
5. Update `last_seen_urls` = `(last_seen_urls ∪ current_urls)` capped at most-recent 500 URLs (cap chosen for: typical search returns 20-50 results, 500 = ~10 runs of history before old URLs roll off; bounds row size to ~30KB)
6. Update `last_run_at = now()`, `next_run_at = now() + cadence_hours`

**URL stability per platform:**
- Depop: stable (canonical product URL)
- Grailed: stable
- eBay: stable
- Mercari: stable
- Poshmark: stable
- Vestiaire: stable (when listings exist; URL discovery is separately broken per memory)
- ThredUp: stable

URL stability is good enough that we don't need fuzzy matching. If a platform ever rewrites URLs, we'll see a phantom "new" wave once, then it stabilizes.

**Edge case:** first run of a new alert sees everything as "new" — would spam a giant initial email. **Mitigation:** on first run, populate `last_seen_urls` but suppress the notification. The first email comes on run #2 onward.

### Cron execution

systemd timer on Hetzner fires every 15 minutes → HTTP GET to `localhost:3000/api/cron/run-alerts` with a shared-secret header.

The route:
1. Authenticates the shared secret (env var `CRON_SECRET`)
2. Queries `saved_searches WHERE next_run_at <= now() AND NOT paused LIMIT 20` (cap per tick)
3. For each due row, enqueues a background search via the existing `runSearchJob` worker, passing a callback that updates `saved_searches` + sends notifications when done

Why 15-min ticks: matches the finest cadence we'd realistically expose (a 1-hour alert is checked within 15 min of due). 20-row cap per tick prevents stampede; spreads load across ticks.

### Notification delivery (first ship: email + in-app)

| Channel | Implementation |
|---|---|
| **In-app toast** | Supabase Realtime broadcasts on `saved_searches` row update → BackgroundSearchToaster (built in Phase 3) extends to handle this event type |
| **Email** | Resend API call. Free-tier users: daily digest (one email/day per user listing all alerts with new matches). Pro users: per-alert email near-realtime. Template under `lib/emails/alert-notification.tsx` (React Email components). |

Web Push (Service Worker) is **deferred** to a follow-up — requires extra UX for granting browser push permission, not necessary for first ship.

### `/api/saved-searches/*` routes

| Route | Behavior |
|---|---|
| `GET /api/saved-searches` | List user's saved searches with `unread_match_count` |
| `POST /api/saved-searches` | Create new (rejects if user has hit `max_saved_searches`) |
| `PATCH /api/saved-searches/:id` | Edit query/filters/cadence/paused |
| `DELETE /api/saved-searches/:id` | Delete |
| `POST /api/saved-searches/:id/mark-seen` | Reset `unread_match_count = 0` when user opens the alert |
| `POST /api/saved-searches/:id/run-now` | Manual re-trigger (Pro only? to be decided) |

### UI components needed

- `app/components/alerts/SearchAlertsTab.tsx` — list of saved searches, each card showing: query, cadence, last run, "X new matches" badge
- `app/components/alerts/SavedSearchCard.tsx`
- `app/components/alerts/CreateAlertModal.tsx` — modal for creating/editing
- Top-nav 🔔 icon with red dot when any alert has `unread_match_count > 0`

### "Save as alert" CTA on search results

When user runs a manual search and sees results, show a small 🔔 button near the filter bar: *"Save this search for alerts."* Click → opens CreateAlertModal pre-filled with the current query + filters.

This is the killer entry point. Most users will discover Search Alerts through this CTA, not by navigating to `/alerts` cold.

### Files touched (Phase 4)
- new: Supabase migration for `saved_searches` table + `profiles` columns
- new: `app/(protected)/alerts/page.tsx`, `app/(protected)/alerts/AlertsTabsClient.tsx`
- new: `app/components/alerts/SearchAlertsTab.tsx`, `SavedSearchCard.tsx`, `CreateAlertModal.tsx`
- new: `app/api/saved-searches/route.ts` + `[id]/route.ts` + `[id]/mark-seen/route.ts` + `[id]/run-now/route.ts`
- new: `app/api/cron/run-alerts/route.ts`
- new: `lib/emails/alert-notification.tsx` (React Email)
- new: `lib/alertRunner.ts` — wraps `runSearchJob` with diffing + notification logic
- new: systemd units on Hetzner (`crawli-alerts.timer`, `crawli-alerts.service`)
- edit: `app/api/webhooks/stripe/route.ts` — sets `max_saved_searches` + `min_alert_cadence_hours` on tier change
- edit: `app/components/SearchSection.tsx` — "Save as alert" CTA button
- edit: top-nav (`AuthButton.tsx` or parent) — 🔔 icon with unread badge
- move: `app/components/profile/WatchlistTab.tsx` → `app/components/alerts/TrackedItemsTab.tsx` (rename only)
- edit: `app/(protected)/profile/page.tsx` — redirect for `?tab=watchlist`

### Verification (Phase 4)
- [ ] Create a saved search, manually trigger run → see results saved correctly
- [ ] Wait for cron tick → search runs automatically, `last_run_at` updates
- [ ] First run does NOT email (only populates `last_seen_urls`)
- [ ] Second run with no new matches → no email, `unread_match_count` stays 0
- [ ] Second run with new matches → email arrives, in-app toast fires, badge appears on 🔔 icon
- [ ] Click 🔔 → routes to `/alerts?tab=search`, badge clears after `mark-seen` fires
- [ ] Hit `max_saved_searches` cap → POST returns 402 with upgrade hint
- [ ] Pause an alert → cron skips it
- [ ] "Save as alert" CTA on search results creates the alert with right query + filters

---

## ✅ Tier strategy SHIPPED 2026-05-26 (three-tier model)

Implementation landed: SQL migration at `docs/migrations/three-tier.sql`,
webhook + checkout switched on price ID, search/alert/tracked caps now
profile-driven, native-results cap applied in `lib/searchWorker.ts`, three-card
pricing page live. See HANDOFF.md latest-change for full file list.

## Tier strategy (locked 2026-05-26 — three-tier model)

Decided after cost re-analysis post-Phase-4 ship. Three tiers, 24h cadence
across the board (12h removed — too costly per alert run, may return later as a
Max-only perk if data justifies).

### Final tier table

| | **Free** | **Pro** $10/mo · $100/yr | **Max** $30/mo · $300/yr |
|---|---|---|---|
| Searches / month | 10 | 75 | 300 |
| Search alerts | 1 | 3 | 10 |
| Alert cadence | 24h | 24h | 24h |
| Tracked listings | 50 | 200 | 1,000 |
| Up to results per native platform | 10 | 30 | 60 |
| Alert health sparkline | — | — | ✅ |
| Email notifications | ✅ | ✅ | ✅ |

### Cost model behind these caps

Per-search worst case (all 7 alert-eligible platforms, no cache, today's
hybrid Brave/Firecrawl + native Grailed/ThredUp setup): **~$0.069/search**.
Per-alert-run worst case (same minus eBay): **~$0.048/run**.
Tracked-listing refresh: **~$0** (self-hosted httpx → Playwright cascade,
Firecrawl never touched).

| Tier | Worst-case cost/mo | Net revenue (post-Stripe) | Margin worst | Margin realistic (~40% util) |
|---|---|---|---|---|
| Free | $2.13 | $0 | -$2.13 (intentional subsidy / trial) | -$0.85 |
| Pro $10 | $9.50 | $9.41 | -$0.09 (break-even) | ~+$5 |
| Max $30 | $35.10 | $28.83 | -$6.27 | +$10-12 |

Max's worst-case loss is acceptable because:
1. Realistic utilization is 30-50% of cap, not 100%.
2. Future platform migrations to native search-page extraction (Mercari,
   Vinted next on the roadmap) will drop alert-run cost ~50%, moving Max
   into positive worst-case margin without changing the price.
3. The worst-case Max user is the highest-LTV customer — subsidizing them
   is a moat, not a leak.

### "Up to N results per native platform" — what this means

This cap applies **only to platforms in `SEARCH_PAGE_PLATFORMS`** (currently
grailed, thredup, realreal). For those, the sidecar does **one Playwright
render** and extracts however many listings the grid contains — pulling 10
vs 60 from the same render is $0 marginal. URL-discovery platforms (vinted,
stockx, poshmark, depop, vestiaire, mercari, ebay) are bounded by the
Brave/Firecrawl `limit=20` already, untouched by this cap.

It's a **ceiling, not a guarantee** — a narrow query like "vintage Margiela
tabi size 41" might only return 7 listings even on Max. Frontend copy must
say "up to N" explicitly so users don't expect a floor.

**Frontend clarification work (Phase 4.5):**
- Pricing page card: "Up to 60 listings per platform (when available)" — not just "60 listings per platform"
- Settings → Billing usage row: no change (this isn't a metered resource).
- Result-count display on search results: optional tooltip near the platform header — "Showing 23 of up to 30 on Pro. [Upgrade to Max for up to 60.]" Only show the upsell if the platform actually returned ≥ tier cap (i.e. the cap is the bottleneck, not the query).
- Empty/short result states: do NOT show upsell when fewer results returned because the platform had nothing — that misrepresents what the upgrade gives.

### Schema impact

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_search_alerts int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_tracked_listings int DEFAULT 50,
  ADD COLUMN IF NOT EXISTS native_results_cap int DEFAULT 10;
```

(`max_saved_searches` already exists from Phase 4 — rename optional; the
two new columns are net additions. `min_alert_cadence_hours` becomes
effectively dead since all tiers are 24h, but leave the column in place in
case 12h returns as a Max perk.)

The Stripe webhook in `app/api/webhooks/stripe/route.ts` sets all three
columns on `subscription.created/updated`. Pro and Max each get a distinct
`STRIPE_PRICE_ID_*` env var; the webhook switches on price ID.

### Env vars to add for Max tier

```
STRIPE_PRICE_ID_MAX_MONTHLY=price_...
STRIPE_PRICE_ID_MAX_YEARLY=price_...
```

(Pro's existing `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_YEARLY` stay
as-is; consider renaming to `_PRO_` for parity once Max ships.)

---

## Risks + open questions for later

1. **Resend free tier (3000/mo, 100/day) will get tight fast.** If 50 users get
   daily digests for a month, that's already 1500 emails. Pro per-alert is on
   top. Plan to upgrade to Resend paid ($20/mo for 50K) before alerts go GA.
2. **Search costs.** Every alert run = 1 background search worth of platform
   load. Tight caps + spreading runs across the day matters. Tune
   `cadence_hours` defaults aggressively at launch.
3. **eBay still uses LLM extraction** (per HANDOFF §7 A) — alerts running eBay
   queries on a cron will accumulate OpenAI cost. Consider excluding eBay from
   alerts initially, or charging higher tier for eBay-included alerts.
4. **First-run email suppression** must be tested carefully — easy to miss in QA.
5. **Duplicate alerts per user.** Should we prevent two alerts with identical
   query+filters? Soft warning at creation time, not a hard block.
6. **Tracked-items refresh cadence.** Current watchlist refresh is manual-only.
   Could become a cron job in Phase 4+ (auto-refresh prices daily for Pro). Out
   of scope for this plan.

---

## Order of operations (TL;DR)

1. **Phase 1** — Saves to `/saves` (half day)
2. **Phase 2** — Profile page dashboard (half day)
3. *Pause and ship 1+2. Get user feedback. Decide tier numbers.*
4. **Phase 3** — Background searches Phase 0+1 (1.5 days)
5. **Phase 4** — `/alerts` page + Search Alerts feature (2 days)

Steps 1+2 are safe to ship this week. Steps 3+4 are a focused mini-sprint after.

---

## Cleanup checklist (do these when all phases complete)

- [ ] Delete this file (`docs/PLAN_SAVES_ALERTS.md`)
- [ ] Update HANDOFF.md with new latest-change block describing the final shape
- [ ] Update HANDOFF.md §3 Architecture and §4 File Structure to reflect new routes
- [ ] Update HANDOFF.md §6 Status by Platform if anything changed there
- [ ] Update HANDOFF.md §7 Open Problems — close Watchlist/Saves discoverability items
- [ ] Update memory: mark `project_roadmap.md` (Watchlist saved-searches is now done)
- [ ] Update memory: mark `project_background_searches_deferred.md` as resolved
- [ ] Delete `docs/BACKGROUND_SEARCHES_PLAN.md` if fully consumed (Phase 0+1 shipped)

---

## ⚠️ When the three-tier pricing ships → update HANDOFF.md

When the Max tier + updated caps + native-results-cap lever land in code/prod, add a
"Latest change" entry to HANDOFF.md covering:

1. **Tier table** — Free 10/1/50/10, Pro $10 75/3/200/30, Max $30 300/10/1000/60 (24h cadence across all tiers).
2. **Cost model** — worst case Free $2.13 / Pro $9.50 / Max $35.10 per user/mo; net margin Pro break-even worst, Max -$6 worst / +$10 realistic. Fixed floor still $40/mo ($20 Hetzner + $20 Firecrawl Hobby).
3. **Schema changes** — new `profiles` columns `max_search_alerts`, `max_tracked_listings`, `native_results_cap`; webhook switches on Stripe price ID to set the three of them.
4. **Frontend additions** — "up to N" copy on pricing cards; tier-aware upsell tooltip on native-platform result counts (only when cap is bottleneck).
5. **Stripe price IDs** — Max monthly + yearly created in both test and live Stripe modes; env vars added.
6. **What this replaces** — the 100-searches / 5-alerts Pro at $10 from 2026-05-23 is gone. Anyone on the old plan should be grandfathered or migrated (decide before flipping).

Then update SCALING.md §8 cost model with the new per-tier worst-case numbers
(currently still uses the pre-tier-restructure rough buckets).
