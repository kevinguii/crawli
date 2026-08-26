# Paid alert-speed customization — design

**Author:** Claude (brainstorming session with Kevin) · **Date:** 2026-08-25
**Status:** approved by Kevin, pending implementation plan

## Context

`docs/planning/AUDIENCE_AND_HOOKS_PLAN.md`'s "The monetisation problem" section
(Q7) identified that every paid feature today answers a *seller's* question
(margin, sold comps), while F2b showed buyers are more numerous and engaged than
resellers. The section proposed selling alert **speed** instead: alerts currently
check once every 24 hours on every tier — `TIER_CAPS.{free,pro,max}.minAlertCadenceHours`
is 24 across the board (`lib/tierCaps.ts:82-84`) — so nobody, paid or free, can be
told about a new listing faster than a day late. For someone hunting one specific
item, being told sooner than a competing buyer is the entire value.

Kevin approved the idea and specified: free stays at 24h default, paid can
customize down to hourly, paid's default on a **new** alert should be hourly (not
24h), and this should be marketed on the pricing page and shown to free users as a
locked enticement to upgrade.

## Requirements (confirmed with Kevin during brainstorming)

1. **Cadence range:** fixed preset steps, not a free-form slider — **1h / 3h / 6h /
   12h / 24h (Daily) / 168h (Weekly)**. Nothing faster than hourly.
2. **Scope:** per-alert, not account-wide. `saved_searches.cadence_hours` already
   exists at this granularity — no schema change.
3. **Free-tier preview:** the four fast presets (1h/3h/6h/12h) render in the
   alert-creation modal for free users too, but locked (blurred + lock icon,
   matching the app's existing paywall pattern) rather than hidden — this is the
   "shown to entice upgrade" surface.
4. **New-alert default:** a **new** alert defaults to 24h for free (unchanged) and
   **1h for paid** (changed from today's 24h default). Editing an existing alert
   never force-changes its current value.
5. **Odd-hour delivery, confirmed explicitly:** sub-daily cadences may email at any
   hour, including overnight. The existing "anchor to 9am so nobody gets emailed at
   3am" protection is a Daily/Weekly-only concept — suppressing an hourly match
   until morning would defeat the reason someone paid for it.
6. **Marketing:** pricing page copy updated, and a new claim-ledger entry added per
   CLAUDE.md's rule that copy needs a ledger entry before shipping.

## What already supports this, so the change is smaller than it looks

- `TIER_CAPS.{tier}.minAlertCadenceHours` is already a **floor**, not a fixed
  value — it's the reason free is currently restricted to picking Daily or Weekly
  (both `>= 24`). Lowering Pro's floor from 24 to 1 is the entire tier-gating
  change; the "is this preset allowed" check the UI and API already perform against
  the floor needs no new logic, just a wider set of presets to check it against.
- `saved_searches.cadence_hours` is already per-row (per-alert), already an
  integer, already flows through `applyCriteria`/`runAlert` generically.
- Alerts never touch the metered Firecrawl platform (`ALERT_EXCLUDED_PLATFORMS`
  excludes eBay) and `lib/searchCache` fans one scrape out to every user watching
  the same query, so a faster cadence for one paid user doesn't multiply scraping
  cost the way it would for a naive per-user re-scrape.
- The cron already ticks every 15 minutes (`docs/reference/SERVER_REFERENCE.md`)
  against ~13 live alerts today — an hourly alert is at most 15 minutes late to be
  picked up, which is the real-world granularity "hourly" actually means and should
  be reflected in copy (don't imply to-the-second precision).

## What has to actually change

### 1. Scheduling logic — `lib/alertSchedule.ts`

`nextAnchoredRunAt` currently treats every cadence as "anchor to the next 9am
local, N days out" (`daySpan = Math.max(1, Math.round(cadenceHours / 24))` — the
`Math.max(1, ...)` floor is exactly why sub-24h cadences don't work today; a 1-hour
cadence currently rounds up to "1 day out at 9am," silently behaving like Daily).

**New behavior:** branch on `cadenceHours < 24`. Below that threshold, the next run
is simply `base + cadenceHours` in real time — no timezone anchor, no 9am
adjustment, may land at any hour. `cadenceHours >= 24` keeps today's exact
9am-anchored behavior unchanged (Daily/Weekly are not touched).

`cadenceLabel()` currently hardcodes a binary (`168 -> 'Weekly'`, everything else
-> `'Daily'`) — this would mislabel a 1-hour alert as "Daily" today and needs a
real label per preset (e.g. "Hourly", "Every 3 hours", "Every 6 hours", "Every 12
hours", "Daily", "Weekly").

`cadenceScheduleLabel()` hardcodes `` `${cadenceLabel(hours)} at 9 AM` `` for every
cadence — needs to drop "at 9 AM" entirely for sub-daily cadences, since there is
no anchor time for those.

### 2. Tier config — `lib/tierCaps.ts`

`pro.minAlertCadenceHours`: `24 -> 1`. `max.minAlertCadenceHours`: `24 -> 1` too,
for consistency, even though no real account resolves to `max`
(`scripts/verify-paywall.mts` already guards that). `free.minAlertCadenceHours`
stays `24`, unchanged.

### 3. UI — `app/components/alerts/CreateAlertModal.tsx`

- Cadence preset list grows from two buttons (`24 | 168`) to six:
  `1, 3, 6, 12, 24, 168`.
- Each preset's "allowed" check already exists in spirit (`mayPickDaily` compares
  the floor against 24) — generalize it to `presetHours >= minCadence` for every
  preset, not just the one Daily/Weekly comparison.
- Presets below `minCadence` render locked: blurred/greyed with a lock affordance
  consistent with `LockedOverlay.tsx`'s established visual language (this doesn't
  have to reuse that exact component, since it's a button-in-a-row, not a
  full-panel blur, but the greyed-lock-icon-upgrade-CTA language should match, not
  invent a new locked-visual style for the app).
- Clicking a locked preset shows the same upgrade prompt pattern already used
  elsewhere (`track({name: 'paywall_view', ...})` equivalent, so this new surface
  is measurable the same way existing paywalls are).
- **Default on a new alert:** once tier data resolves (`isPaid`/`minCadence`
  already fetched async today), a **new** alert's initial cadence selection becomes
  `1` for paid, `24` for free — replacing today's hardcoded `useState(24)` default,
  but only for the create path. `editingAlert.cadence_hours` continues to take
  precedence when editing, unchanged.

### 4. Pricing page + claim ledger

- `app/pricing/PricingCards.tsx` line ~114, `'Unlimited alerts, checked daily'` ->
  something reflecting the new hourly default for Pro (exact copy is an
  implementation-time decision, not a design-time one — the requirement is just
  that it stop claiming "daily" once Pro's real default is hourly).
- New entry in `docs/planning/COMPETITIVE_POSITIONING.md` §6b's claim ledger (next
  available letter, currently through C7), status "Built, unvalidated" following
  the pattern of C1/C3/C5. Wording constraint to record: cron granularity means
  "hourly" is *within about an hour*, not literally instant — copy must not imply
  real-time/to-the-second delivery.

## Explicitly out of scope for this build

- Any cadence faster than hourly (ruled out in brainstorming — see requirement 1).
- Account-wide cadence settings (ruled out — see requirement 2).
- Writing the actual TikTok/marketing hook content around this feature — that's
  downstream of shipping, and belongs in `idea-triage.md`'s next batch, not in this
  implementation.
- Any change to alert **count** caps (`maxSavedSearches`) — this spec is about
  cadence only.

## Testing / verification expectations for the implementation plan

- Extend `scripts/verify-alert-query.mts` or add a sibling script covering:
  scheduling math for each new preset (especially the sub-24h branch landing at
  `base + N hours` with no anchor), the floor-based allow/lock check for every
  preset at both tiers, and that editing an existing alert never silently changes
  its stored cadence.
- Manual verification in a real browser: create a new alert as a free account (four
  fast presets locked, defaults to 24h) and as a paid account (all six unlocked,
  defaults to 1h), per this repo's standing rule that UI changes need real-browser
  verification, not just type-checks.
- `npx tsc --noEmit` clean, as always.
