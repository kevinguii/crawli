# Background Searches + Notifications — Implementation Plan

> **Status:** deferred until payments, hosting, and search-speed work are done.
> When picking this up, read this file first — every decision below has been
> made, so the next session can go straight to Phase 0 without re-deciding.
>
> **Last planned:** 2026-05-21.
> **Source design notes:** [HANDOFF.md](../HANDOFF.md) §"Concise considerations: background searches".

---

## Why this feature

Searches take 30+ seconds and people leave the tab. Current model is a streaming
NDJSON `Response` — closing the tab or navigating away kills the connection and
the user loses all results. There's no server-side persistence of an in-flight
search; it lives entirely in the browser's `ReadableStream`.

This feature lets a user:
- start a search
- close the tab / navigate away
- get an in-app toast + favicon badge when the search is ready
- (later phases) come back to a `/search/[jobId]` page from the toast click

It also enforces "one in-flight search per user" so a refresh-spam doesn't
fan out 20 parallel searches into the load-management gates.

---

## Prerequisites (must be done first)

Per user instruction 2026-05-21:

1. **Payments** — Stripe or similar wired up. Background searches are a "logged-in users only" feature; until accounts have a billing tier, there's no rate-limiting story for "user A starts 50 background jobs in parallel."
2. **Hosting** — Crawli running on a real VPS (not laptop). Background jobs need the Next.js process to live past tab-close, which means a managed deployment with restart policy. See [SCALING.md §6 Solo → Small VPS](../SCALING.md) playbook.
3. **Search speed** — searches need to be fast enough that the 1-2s Realtime polling jitter doesn't dominate user-perceived latency. If a search already finishes in 8s, background mode buys nothing. If it takes 60s, background mode is essential.

Once all three are done, this is the **first extra feature** the user wants to ship.

---

## Locked-in design decisions (made 2026-05-21)

| Decision | Choice | Reasoning |
|---|---|---|
| **Rollout** | Opt-in toggle, streaming stays default | Lower risk, keeps both paths working. Lets us A/B and lets users with snappy 5-platform searches keep the NDJSON push UX. |
| **Conflict handling** | Block + 409 + banner "you have one running" | Predictable. No silent cancellation of work the user might want. Enforced server-side by a partial unique index. |
| **First PR scope** | Phase 0 + Phase 1 only (smallest viable cut) | ~1.5 days. Background mode works; toast on completion; favicon badge. Ship, then iterate. |
| **Worker execution** | In-process via `setImmediate`/`queueMicrotask`, fire-and-forget | Simplest. Worker dies with Next.js process — accept the abandoned-job risk for the first PR; Phase 3 stuck-job sweeper closes the gap later. |
| **Notification layer** | Supabase Realtime + in-app toast + favicon badge | Free, no extra infra, works when tab is open. Service Worker + Web Push and email (which works when tab is closed) deferred to Phase 4. |

---

## Architecture

```
Today                                    Background mode
─────                                    ───────────────
Browser ── fetch ──► /api/search         Browser ── fetch ──► /api/search/background
       ◄── NDJSON ──                            ◄── {jobId} ──
       (tab must stay open)                            │
                                                       │ subscribes
                                                       ▼
                                         Supabase Realtime ◄─── worker writes
                                                       │           progress to
                                                       ▼           search_jobs row
                                                  React UI
```

The worker runs the same `searchAndScrape` per-platform fan-out the streaming
route does today — just writes progress to a DB row instead of pushing NDJSON.

---

## Phase 0 — Schema + worker extraction (NO UX change)

Goal: data layer + worker function ready without changing user-facing behavior.
The current streaming path keeps working as-is.

### `search_jobs` schema

```sql
CREATE TABLE public.search_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query           text NOT NULL,
  platforms       text[] NOT NULL,
  filters         jsonb,
  status          text NOT NULL CHECK (status IN ('pending','running','done','failed','cancelled')),
  progress_json   jsonb,           -- { statuses: {ebay:'done',...}, counts: {...}, errors: {...} }
  result_json     jsonb,           -- final SearchResponse payload when status='done'
  started_at      timestamptz,
  finished_at     timestamptz,
  last_heartbeat_at timestamptz,   -- updated periodically by worker; used by Phase 3 sweeper
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One in-flight job per user, enforced at the DB layer
CREATE UNIQUE INDEX search_jobs_one_in_flight_per_user
  ON public.search_jobs(user_id)
  WHERE status IN ('pending','running');

CREATE INDEX search_jobs_user_created_at
  ON public.search_jobs(user_id, created_at DESC);

ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own jobs" ON public.search_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own jobs" ON public.search_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own jobs" ON public.search_jobs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own jobs" ON public.search_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- CRITICAL: see HANDOFF.md §4 "Critical permissions gotcha"
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_jobs TO authenticated;

-- Enable Realtime broadcast on this table (Supabase dashboard or:)
ALTER PUBLICATION supabase_realtime ADD TABLE public.search_jobs;
```

### Worker extraction

| Change | File | Notes |
|---|---|---|
| Extract platform fan-out into `runSearchJob` | new [lib/searchWorker.ts](../lib/searchWorker.ts) | Pure async function: `runSearchJob(jobId, supabase)`. Reads job row, runs platforms, writes progress + result back via UPDATE. Same `allSettledWithConcurrency` + `SEARCH_PLATFORM_CONCURRENCY` semantics. |
| Refactor streaming route to use the new helper | edit [app/api/search/route.ts](../app/api/search/route.ts) | Two options: (a) streaming path keeps its own copy of the fan-out logic for now; (b) streaming path synthesizes NDJSON events from worker callbacks. Option (a) is the safer Phase 0 — defer (b) until we're confident the worker behaves identically. |

### Verification

- Run a search through both paths, diff result counts per platform — they MUST match.
- `npx tsc --noEmit` clean.
- Python sidecar unchanged.

**Effort: ~half day.** Pure refactor + new table. Zero UX surface.

---

## Phase 1 — Background mode behind an opt-in toggle

Goal: user can choose "run in background" per search. Tab can close. Toast appears
on completion when the tab is open again.

### New routes

| Route | File | Behavior |
|---|---|---|
| `POST /api/search/background` | new [app/api/search/background/route.ts](../app/api/search/background/route.ts) | Auth check. Validate body (same schema as `/api/search`). Insert `search_jobs` row with `status='pending'`. Fire `runSearchJob(jobId, ...)` via `setImmediate` (NOT awaited). Return `{ jobId }`. On partial-unique-index conflict (Postgres 23505): query the existing in-flight job and return `409 { jobId: existingId, message: 'You already have a search running' }`. |
| `GET /api/search/jobs/:id` | new [app/api/search/jobs/[id]/route.ts](../app/api/search/jobs/[id]/route.ts) | Auth check. Returns row, scoped by `user_id`. Used for initial hydrate and polling fallback if Realtime drops. |

### UI changes

| Change | File | Notes |
|---|---|---|
| "Run in background" checkbox | edit [app/components/SearchForm.tsx](../app/components/SearchForm.tsx) | Default OFF. State lifted to SearchSection. |
| Branch on the toggle | edit [app/components/SearchSection.tsx](../app/components/SearchSection.tsx) | If OFF: existing streaming path unchanged. If ON: POST to `/api/search/background`, then `supabase.channel('job-' + jobId).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'search_jobs', filter: 'id=eq.' + jobId }, handleRow)`. Map `row.progress_json` → existing `ProgressState`. On `row.status === 'done'`, load `row.result_json` into `results` state. |
| 409 conflict banner | edit SearchSection | Show "You already have a search running" banner. For Phase 1, action is just "OK" (no `/search/[jobId]` page yet — that's Phase 2). |
| Global toast listener | new [app/components/BackgroundSearchToaster.tsx](../app/components/BackgroundSearchToaster.tsx) | Mounted in `app/(protected)/layout.tsx`. Subscribes to `search_jobs` filtered by `user_id`. On any row transition to `status='done'`, toast: "Your search '<query>' is ready". Tab-open requirement is fine for Phase 1; Phase 4 adds Web Push for tab-closed. |
| Favicon badge util | new [lib/favicon.ts](../lib/favicon.ts) | Swaps `<link rel="icon">` href to a `data:image/svg+xml` with a red dot when a background job completes. Clears on toast dismiss. |

### Realtime mechanics (gotchas)

- **One channel per session, not per job.** Subscribe once on `BackgroundSearchToaster` mount with filter `user_id=eq.<uid>`. The per-search-page subscription in SearchSection is a separate channel scoped to that specific jobId — fine to have both.
- **Race condition:** if the job finishes between `INSERT` and the browser establishing the Realtime subscription, the browser will miss the final UPDATE. Mitigation: `GET /api/search/jobs/:id` immediately after POST to hydrate initial state. If status is already `done`, skip the subscription.
- **Realtime payload size:** `result_json` could be 50KB+ for a full 10-platform search. Postgres `jsonb` handles it; Supabase Realtime has a default payload limit (check the current quota). If it bites, store the result in a separate small `search_job_results` table and only patch `status` on `search_jobs` — the toast subscription doesn't need the full payload, it just needs the transition.
- **One channel per user concurrent connection limit:** Supabase free tier = 200 concurrent. For early-stage Crawli irrelevant; revisit if we hit it.

### Verification before declaring done

- Streaming path produces identical results to pre-PR (regression check)
- Background search with tab open → toast appears on completion, favicon badge flips
- Background search → close tab → reopen → toast still appears (proves Realtime catches the transition the tab missed)
- Two parallel background-search attempts → second returns 409 with banner
- Auth required: unauthenticated POST to `/api/search/background` returns 401
- Worker still respects `SEARCH_PLATFORM_CONCURRENCY` and the sidecar's semaphore (no unbounded parallelism just because jobs are detached)

**Effort: ~1 day.** Combined with Phase 0: ~1.5 days. Matches HANDOFF estimate.

---

## Phase 2 — Resumable UI + recent-searches surface (deferred)

Goal: notification click leads somewhere. User can come back to a finished search
later, or land on a running one and watch it finish.

| Change | File | Notes |
|---|---|---|
| `/search/[jobId]` page | new `app/(protected)/search/[jobId]/page.tsx` | Server-fetches job row, hydrates SearchSection. If `status='done'` shows results directly; if `running` mounts the same Realtime subscription Phase 1 already built. |
| Toast becomes clickable | edit BackgroundSearchToaster | `onClick` → `router.push('/search/' + jobId)`. |
| "Recent searches" tab | edit profile page OR new dropdown in header | Lists last 10-20 jobs with status badge. Click → resume page. Distinct from existing `search-history` table (which is just query strings). |
| Cancel button for background jobs | edit SearchSection + new `POST /api/search/jobs/:id/cancel` | Worker checks `status='cancelled'` between platforms and exits. Streaming path keeps its existing AbortController cancel. |

**Effort: ~half day.**

### Cancellation cadence gotcha

The worker must check `status='cancelled'` **between platforms**, not mid-render.
Easy to forget if `runSearchJob` is a tight `await Promise.all(...)`. Wrap the
`allSettledWithConcurrency` worker function in a "check cancel flag before
starting" guard. In-flight platform scrapes complete before exit — that's fine,
they're already paid for.

---

## Phase 3 — Cleanup + stuck-job recovery (deferred)

Goal: maintenance. Without this, the table grows forever and crashed jobs stay
`running` indefinitely.

| Change | Where | Notes |
|---|---|---|
| TTL: delete `status='done'` rows older than 7 days | Supabase scheduled function OR Next.js cron route (hit by Vercel cron / uptime monitor) | Or just keep them and feed a permanent "search history" page. |
| Stuck-job sweeper: flip `status='running'` rows with `last_heartbeat_at < now() - interval '15 minutes'` to `'failed'` | Same scheduled function | Defends against Next.js restart abandoning jobs. |
| Heartbeat: worker updates `last_heartbeat_at` every ~30s | edit `runSearchJob` | Sweeper uses heartbeat instead of `started_at` for accuracy. |

**Effort: ~half day.** Optional for first ship; needs to land before any production
deploy that gets restarted (e.g. on each git push).

---

## Phase 4 — Push notifications when tab is closed (deferred, overlaps Phase 2D)

Realtime requires an open tab session. For broader reach:

- **Tab closed, browser open:** Service Worker + Web Push. ~1 day. No third-party cost (browser-native).
- **Browser closed entirely:** email via Resend/SendGrid. Overlaps with Phase 2D price alerts infrastructure — build the delivery layer once, serve both features.

Wait until Phase 2D is on the table before implementing.

---

## Files this feature will touch (full list)

### Phase 0
- new: Supabase migration for `search_jobs` table
- new: [lib/searchWorker.ts](../lib/searchWorker.ts)
- edit: [app/api/search/route.ts](../app/api/search/route.ts)

### Phase 1
- new: [app/api/search/background/route.ts](../app/api/search/background/route.ts)
- new: [app/api/search/jobs/[id]/route.ts](../app/api/search/jobs/[id]/route.ts)
- new: [app/components/BackgroundSearchToaster.tsx](../app/components/BackgroundSearchToaster.tsx)
- new: [lib/favicon.ts](../lib/favicon.ts)
- edit: [app/components/SearchForm.tsx](../app/components/SearchForm.tsx) — toggle
- edit: [app/components/SearchSection.tsx](../app/components/SearchSection.tsx) — branch + Realtime
- edit: [app/(protected)/layout.tsx](../app/(protected)/layout.tsx) — mount toaster

### Phase 2 (deferred)
- new: `app/(protected)/search/[jobId]/page.tsx`
- new: `app/api/search/jobs/[id]/cancel/route.ts`
- new: profile-page "Recent searches" surface (TBD)

### Phase 3 (deferred)
- Supabase scheduled function OR cron route

---

## Interaction with existing load-management work

The PR 1/PR 2 concurrency gates (HANDOFF §"PR 1" and §"PR 2") MUST still apply to
background jobs. Allowing tab-detached searches doesn't mean unbounded parallelism
— it means N users' jobs can fan out in parallel **up to the configured
SEARCH_PLATFORM_CONCURRENCY and sidecar render-semaphore ceilings**, queueing the
rest.

The "one in-flight per user" guard is a separate concern (UX/fairness), not a
load-management one. Per-user fairness ≠ global throughput; both must be enforced.

---

## Open questions to revisit when picking this up

1. **Search-history table relationship.** [app/api/search-history/route.ts](../app/api/search-history/route.ts) already stores past queries. Should `search_jobs` replace it, or live alongside it? Probably alongside — search-history is "what did I search for", search_jobs is "what searches did the system run for me, with results."
2. **Result payload size in Realtime.** Measure actual `result_json` sizes at typical loads before committing to "store full result on the row." If it consistently exceeds 50KB, split into `search_jobs` (small) + `search_job_results` (large), only realtime-publish the former.
3. **Concurrent searches as a paid feature?** Once payments are in, "one in-flight" could become "N in-flight based on tier." Cheap to add later — just bump the partial unique index to a count check.
