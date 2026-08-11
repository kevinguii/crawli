# Onboarding Flow — Design Spec

**Created:** 2026-08-10 · **Owner:** Kevin · **Status:** approved design, ready for planning
**Implements:** `docs/planning/COMPETITIVE_POSITIONING.md` §5 Step 2(a) · measured as EXP-001

---

## 1. Why this exists

Crawli has no onboarding. Both signup paths fall through to `auth/callback/route.ts:8`
(`next = searchParams.get('next') ?? '/search'`), so every new user lands on a blank
search box with alerts nowhere in sight.

### 1a. The evidence that shaped this design (pulled live 2026-08-10/11)

Every searcher bucketed by how many searches they ran in their first 24 hours:

| Searches on day 1 | Users | Ever returned | Avg searches after day 1 |
|---|---|---|---|
| **5+** | 3 | **100%** (3/3) | 14.7 |
| **4** | 5 | **60%** (3/5) | 1.6 |
| **2-3** | 10 | **10%** (1/10) | 0.1 |
| **1** | 10 | **0%** (0/10) | 0.0 |

Monotonic, with the cliff between 3 and 4. 21 of 28 searchers (75%) were active on
exactly one day, ever.

**This overturns the intuition that users churn because they exhaust the free cap.**
Only 3 of 28 ever reached 5 searches in a week. The other 25 quit *before* reaching
the cap. They are not hitting a wall, they are leaving before they find one. The
free tier is not the constraint; first-session depth is.

**Caveats, recorded so they do not harden into doctrine:**
- n is tiny. The 5+ cohort is 3 people and one is the single paid Max user (9 searches
  day 1, 40 lifetime, 3 alerts). Excluding them it is 2 free users, both of whom returned.
- It is correlational. Engaged people search more by definition. The design implication
  survives either causal reading, but the causal claim is not established.
- **These counts are distinct query/platform/filter combinations — not attempts, and not
  charged searches.** Three different numbers, verified 2026-08-10, do not conflate them:
  1. `search_history` carries a UNIQUE index `search_history_dedupe (user_id, query,
     platforms, filters)`, so identical repeats upsert into one row. **True repeat counts
     were never recorded and are unrecoverable** (`search_count` and `record_search` were
     added and reverted the same day).
  2. Quota charges only inside `if (allListings.length > 0)` at
     `app/api/search/route.ts:223-252`. Zero-result searches are free, and cache hits
     early-return before that block so they are free too.
  3. Hence 9 `search_history` rows against a cap of 5 is normal, not a defect — verified
     on the one account where it occurs (2026-05-25, 45 minutes, several typos and
     obscure brands that would have returned nothing).
- **The dedupe biases the gradient conservatively, not optimistically.** If a repeat
  upsert moves `searched_at` forward, a returning user who re-runs an old query has that
  row pulled *out* of their day-1 bucket, lowering their measured day-1 count. That works
  against the observed gradient, so the real effect is at least as strong as measured.

### 1b. Live counts at design time (§6a baseline is 2026-08-07 and stale)

| Metric | §6a baseline | Live 2026-08-10 |
|---|---|---|
| Total users | 36 | **39** |
| Signups /30d | 17 | **20** (~0.67/day) |
| Searchers | 26 | **28** |
| Users with ≥1 alert | 2 | **3** (5 alerts total) |

Growth is happening without additional promotion. Do **not** re-baseline §6a; add these
as a new dated row.

---

## 2. Decisions locked before design

| # | Decision | Rationale |
|---|---|---|
| D1 | Onboarding only. `TIER_CAPS` and pricing untouched. | Keeps EXP-001 clean. The free cap is unreached (§1a), so restructuring it would change nothing. |
| D2 | Branch on question 1: "buying for yourself, or to resell?" | It is §5 Step 0's survey question. One tap, personalizes everything downstream, and logs audience data the project has never collected. |
| D3 | Onboarding costs the user **zero searches**. | Owner constraint. Achieved by design, not by a refund (see §5). |
| D4 | Replayable from Settings. | One flow, two entry points. Replays never re-log first-touch data. |
| D5 | Gate on a DB flag so **existing users onboard too**, not just new signups. | Owner requirement. Also removes the auth-wiring risk entirely (§4). |
| D6 | Sold comps moves to the **tail** of the flow, not the hook. | Owner call. It is reseller-shaped; leading with it mis-serves the buyer branch. |
| D7 | Alerts are the **shared spine** of both branches. | Owner call. Alerts are the one feature that serves buyer and reseller identically. |
| D8 | **Quick, smooth, and visibly tailored.** Four-step spine is a ceiling, not a target. | Owner requirement 2026-08-10. Since the flow is blocking (D-blocking, §3), every added step is a tax on someone who cannot leave. Each screen must either personalize what follows or teach the user something — anything else is cut. "Tailored" must be *visible*: the branch answer should change copy and examples on later screens, not just be logged. |

### Deliberately NOT built

Three things from the source playbook are cut on purpose:

- **Pain-agitation screens and a projected-savings screen.** The playbook's own rule is
  that onboarding length should match pain level, and a low-pain product running a
  high-pain onboarding taxes users who were barely motivated. Revisit if the position
  narrows to resellers and the pain becomes "I am about to eat an $80 loss."
- **Mid-flow rating prompt.** An App Store mechanic. Meaningless on web.
- **Any paywall or upgrade screen.** Out of scope per D1.

---

## 3. The flow

### Shared spine (both branches)

```
1. Branch     "Buying for yourself, or to resell?"     → writes onboarding_persona
2. Seed       "What are you after?"                    → free text + branch-tailored examples
3. Criteria   size + min price + max price             → the real applyCriteria() fields
4. Alert      created; EXP-003 baseline email fires    → both branches converge here
```

Step 4 is the value-delivery point. Everything after it is additive: the user can advance
past it without supplying more input, but cannot leave the flow (§3 Blocking behaviour).

### Reseller tail

```
5r. Sold comps on their item    → POST /api/sold-comps (~1s, free)
6r. Margin after fees           → FlipMargin, already seeded from median sold
7.  Hand off to /search, query pre-filled
```

### Buyer tail

```
5b. Optional, advanceable without input: "Got anything sitting in your closet?
    See what it actually sells for."
    → one input → sold comps → margin
7.  Hand off to /search, query pre-filled
```

**5b is a deliberate conversion surface, not a bolt-on.** It is the on-ramp from buyer
to reseller, it costs nothing to run, and it is the only place in the product where
someone discovers they are sitting on money. It also attacks the §4 tension directly:
if the current cohort is buyers pulled in by the wrong content, this is the cheapest
mechanism available for moving some of them toward the position the product is aiming at.
It sits last, requires no input to move past, and must never be the reason someone is
stuck in a blocking flow.

### Blocking behaviour

**Onboarding is blocking. There is no skip and no exit until it is finished.** Owner
decision 2026-08-10. While `onboarding_completed_at IS NULL`, every protected route
redirects back to `/onboarding`. Completion is the only way out.

Consequences that must be built deliberately rather than discovered:

- **The flow must be short and must never dead-end.** A blocking flow with a broken step
  is a locked account. Every step needs a working "continue anyway" path that advances
  the user without requiring a successful upstream call. Specifically: if sold comps
  returns nothing (below the n ≥ 10 floor, or Grailed/Poshmark upstream breakage), the
  step must advance, not trap.
- **`onboarding_step` is persisted on every advance**, so a user who closes the tab
  resumes where they left off instead of restarting.
- **The tail steps still advance without input.** Steps 5r/6r and 5b are additive; the
  user can move past them without supplying a second item, but they cannot leave the
  flow to another route.
- **Settings replay is not blocking.** By definition the flag is already set, so the gate
  is inert and the user can leave at any time.

Existing accounts are included in the block (§4). The 39 current users will be stopped on
their next visit until they finish. That is the owner's call and is recorded as a risk in
§11, not relitigated here.

---

## 4. The gate (and why there is no auth change)

`(protected)/layout.tsx` already calls `supabase.auth.getUser()` server-side on every
protected page render. The gate goes there:

> If `profiles.onboarding_completed_at IS NULL`, route to `/onboarding`.

Consequences:

- New signups land on `/search`, flag is null, gate catches them. **No `next` param.**
- Existing users hit the same gate on their next visit. Same code path.
- **`app/login/page.tsx` and `app/auth/callback/route.ts` are not modified.**

**This deletes a risk rather than testing it.** The previous plan required appending
`?next=/onboarding` to `emailRedirectTo` (`login/page.tsx:72`) and `redirectTo`
(`login/page.tsx:106`), which depended on Supabase preserving a query param through the
full OAuth round trip. That assumption was never verified and cannot be verified without
a real Google sign-in against a running app. The flag-driven gate does not depend on it.

Also preserved: `login/page.tsx:31` (has-session redirect) and `login/page.tsx:69`
(sign-in redirect) are untouched, as the positioning doc requires.

### One gate, everyone, no exceptions

Owner decision 2026-08-10: **no dismissible variant for existing accounts.** New signups
and the 39 existing accounts are treated identically — blocked until complete. A single
code path, which is also the safest thing to get right when the failure mode is a locked
account.

### Route placement and loop safety

`/onboarding` lives **outside** `(protected)/` as a top-level route with its own
`supabase.auth.getUser()` check. Two reasons:

1. It cannot be caught by its own gate, so the redirect cannot loop.
2. It renders without `AppShell`, so the sidebar's Search / Alerts / Saves / History nav
   is not on screen offering links the gate would immediately bounce. A blocking flow
   that visibly displays navigation it refuses to honour reads as broken.

The loop-safety property is structural rather than a conditional to be maintained, but it
still gets an explicit test (T1) because the consequence of getting it wrong is total
lockout.

---

## 5. Cost model: onboarding consumes zero searches

| Step | Endpoint | Charges a search? |
|---|---|---|
| Sold comps (5r, 5b) | `POST /api/sold-comps` | **No.** Auth-gated, 24h `sold_comps_cache`, ~1s. Its header comment states it does not consume a credit. |
| Alert creation (4) | `POST /api/saved-searches` | **No.** Its only `quota_exceeded` is the `max_saved_searches` cap, not search credits. Verified. |
| Live search | — | **Not run by onboarding.** Step 7 hands off to `/search` with the query pre-filled; the user presses the button themselves. |

So the total is zero, with no refund mechanism, no new endpoint, and no abuse surface.

**`/api/search` is not modified** (CLAUDE.md rule 4 — the streaming NDJSON path is fragile).

### Rejected: the refund design

An earlier draft granted free onboarding searches and refunded them afterwards via
`POST /api/onboarding/complete`, capped by a `MAX_ONBOARDING_REFUND = 2` constant.

**Rejected, and the reason is worth keeping.** The refund attributed by wall-clock window
(everything in `search_history` between start and completion), which does not know what
browser tab the user is in. A second tab running searches while onboarding idles in the
first would have had those searches refunded. The cap was papering over a leaky
attribution rule rather than fixing it. Handing off instead of searching makes the whole
mechanism unnecessary.

---

## 6. Data model

New columns on `profiles`:

| Column | Type | Purpose |
|---|---|---|
| `onboarding_persona` | `text` | `'buyer'` \| `'reseller'` \| null. The §5 Step 0 answer. |
| `onboarding_started_at` | `timestamptz` | Funnel analysis. |
| `onboarding_completed_at` | `timestamptz` | **The gate.** Null = blocked. Set only on completion (there is no skip). |
| `onboarding_step` | `int` | Furthest step reached, persisted on every advance. Powers resume-after-close and per-step funnel analysis. |

Two constraints from the project's own history:

1. **`handle_new_user()` must not hardcode these into its INSERT.** That exact pattern
   caused the cap bugs on 2026-07-17 and 2026-07-23. Let the column DEFAULTs apply.
2. **Explicit `GRANT ... TO authenticated, service_role`** or the table 503s under RLS
   alone (CLAUDE.md gotcha, `docs/migrations/alert-notifications.sql` precedent).

Existing 39 accounts get `onboarding_completed_at = NULL`, which is the default, so the
backfill is a no-op and they are blocked into the flow automatically on next visit.

---

## 7. Copy guardrails (§6b claim ledger)

Marketing copy may only use claims at **Validated**. The onboarding copy **may not**:

| Forbidden | Why |
|---|---|
| Name **Mercari** in any sold-comps context | C1. Mercari was dropped during the probe. Not shipped. |
| Show a **pooled cross-platform median** | §5 finding 1. Grailed $125 vs Poshmark $33 on the same query. A blended figure describes neither market. **Report per platform or not at all.** |
| Say "**what it actually sold for**" about Poshmark | §5 finding 2. Poshmark hides accepted offers; its price is the ask at the moment of sale. Only true of Grailed. |
| Claim any **sell-through** figure | §5 finding 3. No sell-through metric shipped; the denominators are not comparable. |
| Lead with "**best price**" | C6, falsified as a wedge. Gem and Beni do it better and free. |
| Imply **four independent criteria fields** | C3. It is `size` + `minPrice` + `maxPrice`. Brand and keywords live in the query string. |

Every sold-comps figure must display the window that produced it (90d / 180d / 365d), and
the panel does not render below n ≥ 10 after filtering. The onboarding needs a real
empty state for thin-catalogue queries — this will happen and must not look broken.

---

## 8. Experiment disposition

### EXP-001 — revised

| Field | Value |
|---|---|
| Claim | C3 (alerts) |
| **Primary** | Share of users completing onboarding who create ≥1 alert. Keeps the doc's stated metric. |
| **Secondary** | First-session depth (per the §1a gradient) and 2nd-day return (baseline 27%). |
| Kill criterion | Unchanged: below ~15-20% alert creation when offered directly is evidence against the alerts thesis. |

**Named risk:** the §1a gradient measured *live searches*. This flow substitutes cheaper
interactions (sold-comps lookups, alert creation) and runs zero live searches. Whether
those carry the same activation weight is **unknown**. That is why depth is secondary and
instrumented rather than assumed.

### EXP-002 — superseded

Zero exposure at design time: none of the 24 cohort members had run a search since
`AlertCtaBanner` shipped, so the banner was never seen. Owner note: no traffic because
posting has not restarted yet. No result to read and none worth waiting for.

**Disposition:** marked **superseded** in §6c, measurement folded into EXP-001. Do not
record a `0/24` result — its kill criterion would fire on zero evidence.

**EXP-005** (public alert creation) was gated on EXP-001 *and* EXP-002. With EXP-002
superseded, **it is now gated on EXP-001 alone.** Update §6c accordingly.

---

## 9. Testing

`npx tsc --noEmit` clean is necessary and not sufficient.

| # | Test | How |
|---|---|---|
| T1 | **Gate does not loop** | `/onboarding` exempt from its own redirect. Highest-risk line. |
| T2 | Gate fires for a null flag | Set `onboarding_completed_at = NULL` on own row, visit any protected page. |
| T3 | Gate stops firing once set | Complete the flow, confirm no re-prompt on any protected route. |
| T4 | **No escape** | With the flag null, attempt `/search`, `/alerts`, `/saves`, `/watchlist`, `/profile`, `/settings`, `/search-history` directly by URL. Every one redirects to `/onboarding`. |
| T5 | New signup, email path | Real signup through email confirmation. Confirm the gate catches them without any `next` param. |
| T6 | **New signup, Google OAuth** | Real Google sign-in. Same assertion. This is the path whose behaviour was previously assumed — verify it, do not infer it. |
| T7 | **Resume after close** | Advance to step 3, close the tab, sign back in. Lands on step 3, not step 1. |
| T7b | **No dead-end** | Force a sold-comps failure (nonsense query, and separately a simulated upstream error). The step must advance, never trap. This is the lockout scenario. |
| T8 | Zero searches consumed | Record `searches_used_this_period` before and after a full run. Must be unchanged. |
| T9 | Sold comps empty state | Nonsense query, below the n ≥ 10 floor. Must not look broken. |
| T10 | Settings replay grants nothing and re-logs nothing | `?replay=1`. |
| T11 | Alert actually created and baseline email sent | End to end, real inbox. |
| T12 | Light + dark, mobile 375px, no horizontal overflow | Project standard; `/search` had this exact bug on 2026-07-09. |

T5, T6, T11 and T12 are owner-verified in a real browser per project workflow.

---

## 10. Out of scope

- Any `TIER_CAPS` or pricing change (D1).
- Any `/api/search` modification.
- Any `login/page.tsx` or `auth/callback/route.ts` modification.
- eBay or StockX sold comps (deferred per §5).
- EXP-005 public alert creation (still gated, now on EXP-001 alone).
- Landing-page or metadata copy changes (Step 4, blocked until a claim validates).

---

## 11. Open risks

1. **The gate touches every protected route, and it is now a hard block.** A bug here
   locks users out of the entire app with no way around it. This is the single largest
   risk in the build. T1-T4 and T7b are the mitigations, and the "every step must advance
   even on upstream failure" rule in §3 is not optional.
2. **The 39 existing accounts are blocked on next visit.** Someone signing in to check a
   running alert is stopped and made to complete a flow first. Owner decision, recorded
   rather than relitigated. The mitigation is keeping the spine to four steps and making
   the tail advanceable without input.
3. **Activation-weight substitution is unproven** (§8). Instrumented, not assumed.
4. **Sold comps depends on an undocumented Grailed Algolia index and a Poshmark state
   blob.** Silent upstream breakage would make the reseller tail render nothing and look
   identical to disengagement. Run `npx tsx scripts/verify-sold-comps.mts` (33 checks)
   before reading any EXP-001 result.
5. **`search_history` and the quota counter measure different things** (§1a). Resolved,
   not a defect, but any EXP-001 read that mixes the two will be wrong.
