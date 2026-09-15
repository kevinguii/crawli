# Archived design specs

**Written 2026-09-15** (repo archive). 
Condensed replacement for `docs/superpowers/specs/` and `docs/superpowers/plans/`,
which held brainstorming specs and task-by-task implementation plans for features
that have since shipped. Per the CLAUDE.md feature workflow (step 7), those files
are scaffolding and get deleted after merge — **the shipped code is the record.**

What is preserved here is the part code does not carry: the **decisions and the
rejected alternatives**. Everything else (file lists, task checkboxes, interface
signatures) described work that is now done and verifiable in the source.

Full per-session narrative for each of these lives in `docs/CHANGELOG.md`.

---

## 2026-08-25 — Paid alert-speed customization · SHIPPED

**Problem.** Every paid feature answered a *seller's* question (margin, sold comps)
while the audience research showed buyers were more numerous and engaged. Alerts
checked once every 24h on every tier (`minAlertCadenceHours` was 24 across free,
pro and max), so nobody — paid or free — could learn about a new listing sooner
than a day late. For someone hunting one specific item, being told before a
competing buyer *is* the entire value. So: sell speed.

**Decisions, as confirmed during brainstorming:**

1. **Fixed presets, not a slider** — 1h / 3h / 6h / 12h / 24h (Daily) / 168h (Weekly). Nothing faster than hourly.
2. **Per-alert, not account-wide.** `saved_searches.cadence_hours` already existed at that granularity, so **no schema change**.
3. **Free-tier preview.** The four fast presets render for free users too, but locked (blurred + lock icon), rather than hidden — the paywall surface *is* the upgrade nudge.
4. **New paid alerts default to 1h** (free stays 24h). Editing an existing alert never force-changes its stored value.
5. **Sub-daily cadences deliberately fire at any hour, including overnight.** The "anchor to 9am so nobody is emailed at 3am" protection is a Daily/Weekly-only concept; suppressing an hourly match until morning would defeat the thing being paid for. This was explicit, not an oversight.
6. Marketing copy must never imply exactness — the cron ticks every 15 minutes, so "hourly" means *within about an hour*.

**Implementation note worth keeping:** the tier gate was already a floor comparison
(`cadence_hours >= minAlertCadenceHours`), so widening the feature meant widening
the legal preset set and lowering Pro's floor 24 → 1 — plus replacing the
scheduler's day-only anchoring math (`Math.max(1, Math.round(cadenceHours / 24))`,
which silently rounded anything hourly back up to daily) with a branch that does
not anchor to a time of day at all. Live in `lib/alertSchedule.ts`
(`ALERT_CADENCE_PRESETS`, `isCadenceAllowed`, `nextAnchoredRunAt`), verified by
`scripts/verify-alert-cadence.mts`. Migration: `docs/migrations/paid-alert-speed.sql`.

**Known limitation, accepted not fixed:** a downgraded account's existing fast
alerts keep running at their prior cadence until the user edits them; nothing
reclamps `cadence_hours` on existing rows automatically.

---

## 2026-08-26 — Photo search · SHIPPED

**Problem.** The audience research found this audience already uses Google Lens
*in person* — mid-conversation at a garage sale, on a physical item, to identify
and price-check on the spot. That is the real moment of use, and Crawli's only
input was a text box.

**The rejected alternative, and why — the part worth keeping.**
*Reverse image match against live listings* (photo → visually similar items
currently for sale) was ruled out on two independent grounds:

- It requires a **persistent image index over live listings**, which directly
  contradicts Crawli's deliberately live/on-demand search architecture.
- It is **literally Gem's core differentiator.** Building it meant building a
  worse, under-resourced copy of the exact thing the 2026-08-07 strategy reset
  existed to avoid competing on.

**Chosen shape: identify-then-search.** A photo becomes a *text query* via a
vision model, then runs through the existing `/api/search` pipeline unchanged. No
image index, no new storage, no new provider key — it reuses the `resolve_llm()`
/ litellm pattern already built for `/expand-query`.

Rules: **auto-fill only, never auto-run** the search; the field stays editable so
the user can correct or extend the guess; multiple detected items render as
tappable chips rather than guessing which one was meant. OCR of physical tags was
discussed and dropped for v1.

**One reversal worth recording.** The original spec said keep the model's guess
*general* (garment type/color over a specific brand guess, on the theory that a
wrong specific guess is worse than a safe general one). That was **changed during
the build**: the prompt now asks for real specificity and reads visible printed
text and logos rather than avoiding them — which is what fixed a bug where a
legible "SUPREME" wordmark got dropped in favour of a generic description. The
tradeoff: the stricter prompt is measurably more conservative and will return zero
items on a low-quality image where the old one always produced a best-effort guess.

Live in `crawl4ai-service/main.py` (`POST /identify-photo`),
`app/api/search/identify-photo/route.ts`, `app/components/SearchForm.tsx`.

---

## Earlier specs, deleted in previous cleanups

Recorded here because several files still cite them by path. They are recoverable
from git history if ever needed.

| Spec | Feature | Where the detail now lives |
|---|---|---|
| `2026-08-17-paywall-repackaging-design.md` | Two-plan repackaging, price intelligence gated behind Pro | `docs/migrations/paywall-repackaging.sql`, `docs/reference/B2B_FEATURE_TRUTH.md` §5, `COMPETITIVE_POSITIONING.md` EXP-006 |
| `2026-08-22-share-card-*.md` | `/api/share-card` 1080×1350 PNG share artifact | `docs/CHANGELOG.md`; recoverable from commit `b2a36b6` |
| `2026-08-11-onboarding-*.md` | Blocking zero-search-cost onboarding flow | `COMPETITIVE_POSITIONING.md` EXP-001, `lib/onboarding.ts` |
