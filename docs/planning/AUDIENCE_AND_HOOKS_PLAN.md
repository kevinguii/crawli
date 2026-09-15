# Audience, Language File and Hooks

**Created:** 2026-08-19 · **Owner:** Kevin · **Status:** live, multi-session

## How to resume this work (read this first)

This document is the **durable state** for the audience research and hook program.
It is designed so a cold session with no chat history can pick the work up mid-flight.

**If you are a new session starting on this:**

1. Read the **Status board** below. Find the first phase that is not `done`.
2. Read **Findings** so you do not re-derive facts that are already confirmed.
3. Read **Open questions** so you know what is blocked on Kevin.
4. Do that phase.
5. **Update the status board and append to the progress log as work completes, not
   at the end of the session.** A chat that dies mid-phase must leave the board
   accurate. This is the single rule that makes the doc worth having.

**Findings is append-only.** If a fact turns out to be wrong, strike it and add the
correction underneath with the date. Do not delete, because a future session needs to
know the earlier read was tried and failed.

Related docs, read as needed:
- `docs/planning/COMPETITIVE_POSITIONING.md` sections 5 and 6 (claim ledger gates all
  copy; Step 0 is the audience question this plan closes out)
- `docs/planning/GROWTH_PLAN.md` (older diagnosis, some numbers now stale, see F5)
- `docs/reference/B2B_FEATURE_TRUTH.md` (what features actually exist)

---

## Status board

| # | Phase | State | Done when |
|---|---|---|---|
| 0 | Stand up this doc | **done** 2026-08-19 | Doc exists, linked from HANDOFF.md and CLAUDE.md, findings loaded |
| 1 | Mine existing first-party data | **done** 2026-08-19 | Persona cross-tab (F2b), query language (F2c), TikTok sync checked (F7). Step 0 q1 marked answered in COMPETITIVE_POSITIONING.md |
| 1.5 | **Fix F12: alert matching** | **done** 2026-08-20 | Validation shipped (client + server), simplified to one message for all tiers per owner call (F12d). 3 existing dead alerts NOT backfilled by design (Q10), 2 other causes (non-English query, shoe+clothing-size mismatch) still open |
| 2 | Build the Reddit harvester | **done** 2026-08-20 | `scripts/reddit-harvest.mjs` built, parse verified against a live thread. See F14 |
| 3 | Harvest, language file, profile | **done, Kevin approved 2026-08-20** | `language-file.md` and `profile.md` written and quote-verified. Kevin: "i like the information." |
| 4 | Channel ranking | **done 2026-08-20, but see finding** | `channels.md` written. Reddit subs ranked and picked; TikTok/IG/Shorts could NOT be honestly ranked, see F16 |
| 5 | Idea triage and hooks | **read by Kevin 2026-08-25, no objections raised** | `idea-triage.md` written and read. No specific feedback given on any hook — treat as passable, not as an enthusiastic sign-off. Next batch (5 held-back ideas) can proceed |
| 6 | Close the measurement loop | **not started** | Proposal written. Build only on Kevin's say-so |

---

## Why this exists

The source is a widely shared thread by @everestchris6 on organic product marketing.
Its process: pick one person rather than a market, get obsessed with them, collect
their actual sentences from the places they already gather, let the product and the
platform fall out of that, then package ideas as hooks and test two of everything.

That process maps almost exactly onto the repo's own open blocker.
`COMPETITIVE_POSITIONING.md` records **Step 0, settle the audience question**, as
**skipped on 2026-08-10 by owner decision**, and states the consequence: a null
EXP-004 result can no longer separate "sold comps does not change behaviour" from
"these users were never resellers."

So this is not a new marketing side quest. It is Step 0, executed, plus the packaging
work that only becomes possible once Step 0 has an answer.

---

## Findings

Each finding carries its source. Verified facts only. Guesses belong in Open questions.

### F1. The Step 0 question is already shipping in onboarding

`app/onboarding/steps/BranchStep.tsx:16` asks **"Are you buying for yourself, or to
resell?"** with options `For myself / Hunting specific pieces across marketplaces`
and `To resell / Sourcing inventory to flip for profit`.

That is, word for word, the question `COMPETITIVE_POSITIONING.md` Step 0 proposed
emailing all users to ask. It has been collecting into
`profiles.onboarding_persona` since 2026-07-16. **No email campaign is needed for
question 1.**

Step 0's *second* question, "what do you check before you buy something to flip?",
was answered by the phase 3 harvest — see Q4 (2026-08-25): sold price history first
and by far the most, then reverse image search for identification, then
cross-referencing a niche-specific pricing tool. **Step 0 is now fully closed.**

### F2. Persona split and behaviour (pulled 2026-08-19)

> ~~**First read, WRONG, kept per the append-only rule.** `reseller` 8 users / 5
> searchers / **11.4** avg searches; `buyer` 15 users / 13 searchers / **1.9** avg.
> Read as "buyers outnumber resellers 2:1, resellers use it 6x harder."~~
>
> **Corrected 2026-08-19 the same day, see F2b. The entire reseller depth advantage
> was Kevin's own account.** This is exactly what Q1 was written to catch, and it is
> why owner accounts must be excluded from every persona read from here on.

### F2b. Persona behaviour, owner account excluded (the real read)

`afd0c446-0a1d-4ba1-8c84-f85c76e654e5` is `owner@example.com`, the only Pro
account, signed up 2026-05-17, declared `reseller`: **51 searches, 27 active days,
167 saves, 3 alerts.** It is 1 of 8 resellers and carried the whole average.

Excluding it:

| persona | users | searchers | activation | searches per signup | per searcher | returned 2nd day | with alerts | with saves |
|---|---|---|---|---|---|---|---|---|
| `buyer` | 15 | 13 | **87%** | 1.67 | 1.92 | 2 (15%) | **8 (53%)** | **0** |
| `reseller` | 7 | 4 | **57%** | 0.75 | 1.50 | **0 (0%)** | 1 (14%) | **0** |

**The reseller advantage does not exist.** Once the owner is removed, resellers
activate worse (57% vs 87%), search slightly less per searcher (1.50 vs 1.92), have
never returned on a second day (0 of 4), and barely touch alerts (14% vs 53%).

**Three things this establishes:**

1. **Buyers are both more numerous and more engaged.** That is not what
   `COMPETITIVE_POSITIONING.md` section 4 ("the cross-platform sold-price engine for
   people who buy secondhand to resell") assumes.
2. **Alerts are a buyer feature in practice.** 8 of 15 buyers set one; 1 of 7
   resellers did. Section 5 Step 2 treats alerts as the front door, and this says the
   door is being used by buyers.
3. **Nobody except the owner has ever saved anything.** 0 saves across all 22
   onboarded non-owner users. Saves are, so far, a feature with an n of 1.

**Small-n honesty, mandatory when quoting this:** 13 searching buyers against 4
searching resellers. Directional, not significant. The reseller cohort is also
younger (6 of 7 signed up after 2026-08-14) and several have had only days to return,
so the 0% second-day figure is partly a recency artefact and must not be read as a
hard zero yet. Re-pull this in ~3 weeks before treating it as settled.

### F2c. Query language is identical across personas

All 31 non-owner searches, by declared persona:

- **buyer:** Snow Peak Water Repellent Pants · YZY YS-01 · Bape college tee · Vintage
  American eagle · The North face wind breaker · The North face jacket · Billabong
  long sleeve · Stussy crewneck · Stussy hoodie · ed hardy polo · ed hardy · Gucci
  Typhoon · Nike running division pants · Nike running division · Nike running pants ·
  beanie · y2k low rise baggy jeans light wash W25 · jacked jeans · hvyd · Panties ·
  Pink Panties · Panties Thongs · Swim Briefs · Speedos swim briefs
- **reseller:** Levi's baggy jeans · Polo Ralph Lauren · S4lem hoodie · S4lem ·
  polaroid · Samsung s24

**There is no observable difference in query shape between the two personas.** Both
type `brand + garment`. The self-declared persona does not predict behaviour. This
matters: it means the buyer/reseller split may be a distinction users make about
their *intent* that has no expression in how they actually use the product.

Three patterns worth carrying into the profile and the hooks:

- **The vocabulary is streetwear and Y2K, not "secondhand fashion".** Bape, Stussy,
  YZY, Snow Peak, North Face, ed hardy, Billabong, Polo Ralph Lauren, Levi's, S4lem,
  "y2k low rise baggy jeans light wash W25". Nobody types the language the blog is
  written in.
- **People re-search to narrow or broaden, within minutes.** `Nike running division
  pants` then `Nike running division` then `Nike running pants`. `ed hardy polo` then
  `ed hardy`. `S4lem` then `S4lem hoodie`. `Stussy crewneck` then `Stussy hoodie`.
  This is someone hunting a piece they can half-remember and fighting the search box.
  It is direct evidence for the "search/discovery is bad" pain in F5.
- **Non-fashion queries appear in both personas** (`Samsung s24`, `polaroid`, `hvyd`).
  Section 1 finding 3 flagged this and it has not gone away.

### F3. Reddit access paths, tested live 2026-08-19

| Path | Result |
|---|---|
| **Reddit RSS** | **HTTP 200.** `https://www.reddit.com/r/<sub>/search.rss?q=<q>&restrict_sr=1&sort=new&limit=<n>`. Keyless, no quota, no auth. **This is the discovery path.** |
| **Reddit shreddit comments** | **HTTP 200.** `https://www.reddit.com/svc/shreddit/comments/r/<sub>/t3_<postid>?sort=top`. Returned 610 KB for a live r/Flipping thread and parsed cleanly to 11 verbatim comments. **This is the language path.** |
| Reddit `.json` | **403.** Both `www.reddit.com` and `old.reddit.com`, with a browser UA. Dead path from this machine. |

Both working paths need a browser User-Agent header.

### F4. Zernio is real but is the wrong tool here

The user recalled a "Zernio API connected with Reddit." Confirmed: n8n workflow
`URiVWju6wMJcrQiW` ("reddit monitor crawli") calls
`https://zernio.com/api/v1/reddit/search` with account `6a2507082b2567671a0b890c`,
credential `fJu32HkmtmjvrZhX`, on the Hetzner box. The key is not in this repo.

**It is not usable for building a language file**, for two documented reasons in
`docs/planning/AGENT_PLAN.md` section 1B:
1. The free tier throttles at roughly **6 to 8 Reddit searches per run**. The limit is
   upstream (Reddit rate-limiting Zernio's shared OAuth account), not Zernio's own
   per-minute cap, so spacing calls out does not help.
2. It returns **post metadata only. No comments.** Comments are where the language is.

Keyless RSS plus shreddit (F3) has no quota and does return comments. Use that.

### F5. `reddit_research` is a sentiment table, not a language file

1,007 rows, still being written daily (latest 2026-08-16). But:

- **596 of 1,007 rows are r/Depop.** Then vinted 176, poshmark 136, reselling 52,
  Mercari 27, malefashionadvice 11, ThriftStoreHauls 6, Grailed 3.
- **r/Flipping is entirely absent**, which is the single most reseller-dense sub.
- It stores **gpt-4o-mini summaries** (`summary`, `pain_point`, `sentiment`), not
  people's sentences. Only `title` is verbatim.

Pain point distribution: seller trust and scam fear 348 · shipping speed 220 · other
122 · platform fees 95 · counterfeit risk 63 · **search/discovery is bad 53** ·
sizing inconsistency 50 · **price comparison fatigue 32**.

The loudest pains are ones Crawli does not solve. The Crawli-shaped ones are the two
in bold, which is consistent with what `GROWTH_PLAN.md` section 1 concluded at 560
rows.

### F6. The current content motion is founder-led and already un-obfuscated

`tiktok_performance`, by month:

| month | posts | avg views | comments |
|---|---|---|---|
| Jun 2026 | 71 | 153 | 1 |
| Jul 2026 | 18 | 265 | 4 |
| **Aug 2026** | **6** | **143** | **2** |

August posts carry `#crawli` in the hashtags and say things like *"this site would
have saved me hours as a beginner reseller"* and *"find any steal across all online
secondhand in under 30 seconds."*

**The CLAUDE.md rule forbidding URLs, brand mentions and CTAs has already been
abandoned in practice.** The doc is out of date, not the content. Any hook baseline
must be the **August founder-led motion (6 posts, avg 143 views, 2 comments)**, not
the June carousel burst that `GROWTH_PLAN.md` section 1 diagnoses.

### F7. Two measurement gaps block any real test

> ~~**Partly wrong.** "`last_synced_at` maxes at 2026-08-15, the table is stale."
> That conflated `last_synced_at` with `max(published_at)`.~~ **Corrected below.**

1. **The TikTok sync is healthy, just weekly.** `last_synced_at` is **2026-08-16**,
   and the n8n workflow `tiktok performance digest` has run `success` on 2026-08-09
   and 2026-08-16 (checked against `execution_entity` on the box). It fires weekly
   on **Sundays 15:00 UTC**, despite the node being named "Every Monday 8am PT", so
   3 days of staleness on a Wednesday is normal, not a failure. Next run 2026-08-23.
   Feeds from Zernio `/api/v1/analytics`, upserts on `platform_post_id`.
2. **The 0-view rows are probably real zeros, not sync lag.** Three posts read 0
   views: 2026-08-11, 2026-07-28, 2026-06-23. The June one has stayed 0 through a
   2026-07-04 sync and every sync since, so it is not a timing artefact.
   **Not externally verified** — TikTok is JS-rendered and WebFetch cannot read the
   counts, and no browser was driven for this. See Q5.
3. **Instagram and YouTube Shorts have no table at all.** Only TikTok is tracked. Two
   of the three channels in use are unmeasurable, so a channel comparison or a hook
   A/B cannot be read across them. This is the real measurement gap.

### F8. Tooling corrections to CLAUDE.md

- `mcp__n8n__*` is listed in CLAUDE.md but **is not connected**. SSH to
  `root@5.78.187.97` works directly instead (`SERVER_REFERENCE.md:292`).
- Supabase MCP tools are namespaced `mcp__claude_ai_Supabase__*`, not
  `mcp__supabase__*` as CLAUDE.md states. Project id `peyqxfijdrziqfjkxjsn`.

### F9. There are zero real paying customers, and only one real checkout attempt

Pulled 2026-08-20. **59 users. 1 active subscription, and it is the owner's own
account.** 0 users hold search credits. 1 profile has ever had a
`subscription_period_end`.

6 profiles carry a `stripe_customer_id`, which reads like 6 checkout attempts. It is
not. Three of them are owner-controlled (`owner`, `owner-alt-1`, `owner-alt-2`,
all created 2026-05-17 to 2026-05-25). The remaining three are
`kiara.julia.choi`, `ashleymadisson213` and `jonahkatsumata`.

**So the honest count of non-owner humans who have ever reached Stripe is 3, and
zero of them completed.** Every revenue-side number in the older docs should be read
against that, including the "first revenue ever" line in section 1.

### F10. Every deeply engaged non-owner user came from a single day

Sorting all 59 users by active days, the only non-owner accounts that have ever saved
a listing or tracked one are:

| email | signed up | searches | active days | saves | tracked |
|---|---|---|---|---|---|
| kiara.julia.choi | **2026-05-25** | 19 | 6 | 26 | 1 |
| sustinfn | **2026-05-25** | 7 | 3 | 1 | 2 |
| owner-alt-2 (owner alt) | **2026-05-25** | 7 | 2 | 6 | 1 |

**All three signed up on 2026-05-25.** Nobody acquired since has ever saved or
tracked anything. `kiara.julia.choi` is, apart from the owner, the most engaged user
the product has ever had: 19 searches across 6 days spanning a month, 26 saves.

**Confirmed by Kevin 2026-08-25 (Q8): "probably yes the first 8 are me and friends."**
This was inference from date-clustering when first written; it is now a settled fact,
not a guess. **Consequence: saves and tracked listings have never once been adopted
by a user who arrived on their own.** Every data point on either feature so far comes
from a hand-walked-through friend, not an organic signup. The feature set has a
confirmed organic n of 0 — not "probably 0," actually 0. Any future claim that saves
or tracked listings are "working" needs a genuinely new, non-seeded user adopting
them before it's true.

### F11. Signups have accelerated about 5x in August

| window | signups/day |
|---|---|
| Jun 2026 | ~0.3 |
| Jul 2026 | ~0.35 |
| **2026-08-14 to 2026-08-20** | **2.7** (19 in 7 days) |

The older docs' "~0.67/day and plateaued" is out of date. This coincides with the
founder-led TikToks of 2026-08-11 to 2026-08-15 (F6). **Correlation only** — no UTM
or referrer data exists to attribute it, and the window is a week. But it is the
first time any content has moved this number, and it argues the acquisition problem
is closer to solved than the retention problem.

### F12. 36% of real user alerts are structurally incapable of ever matching

**This is the most actionable finding in the whole pass, and it has nothing to do
with buyer vs reseller.**

Of 12 non-owner alerts, five have produced zero matches across every run:

| user | alert query | runs | matches |
|---|---|---|---|
| romeosd16 | `hvyd, darc sport, controlled insanity, jacked jeans` | 8 | **0** |
| japelmathis | `Des vêtements Nike running rare` | 5 | **0** |
| joseflexis324 | `S4lem hoodies, rick owens` | 4 | **0** |
| koceila.abdelaziz87 | `Sneakers` (size `m`) | 2 | **0** |
| vespashaw15 | `carhartt wip jacket` (size `s`, $5-30) | 1 | 0 |
| timothyestigoy24 | `Bape, supreme, jerseys` | 0 (new) | 0 |

**Root cause, confirmed in code, not inferred:**

1. `relevanceTokens` (`lib/parse.ts:79`) strips all punctuation, so **commas
   disappear**: `"bape, supreme, jerseys"` becomes the token set
   `{bape, supreme, jerseys}`.
2. `lib/parse.ts:156` then applies `if (!anchors.every(anchorSatisfied)) return false`
   — **a listing title must contain EVERY anchor token in the query.**

So a comma-separated brand list requires one listing whose title contains all of
`hvyd` AND `darc` AND `sport` AND `controlled` AND `insanity` AND `jacked` AND
`jeans`. **No such listing will ever exist.** These alerts are guaranteed to return
zero forever, and they run daily against real scraping cost.

This is not a bug in the code, which does exactly what it documents. It is a
**mismatch between the system's AND-only semantics and the way users naturally write
an alert**, which is as a list of things they want. `lib/alertRunner.ts:19` even
flags it: *"OR-within-a-field (brand A OR brand B) is a flagged later extension."*
That extension is not optional. It is the difference between an alert working and
never working, for a third of the people who set one.

**Two secondary causes in the same set:**
- **Non-English queries break entirely.** `Des vêtements Nike running rare` loses
  the accented word to the punctuation strip and still requires every remaining
  token. Nothing matches.
- **Size filters applied across category.** `Sneakers` with clothing size `m` cannot
  match: `matchListingSize` (`lib/sizeFilter.ts:85`) tests `m` against
  `CLOTHING_PATTERNS`, and sneaker listings do not carry a clothing size M.

### F13. Alert emails are firing daily and almost nobody opens them

42 notifications have been generated for non-owner users. **9 are marked seen, and 8
of those 9 belong to one person** (`jonahkatsumata`, whose `Stussy` alert has 35
matches and 6 of 7 notifications seen).

Combined with F12, the picture is: the alert system runs reliably, a third of alerts
can never fire, and of the ones that do, a single user is reading them.

`jonahkatsumata` is the one genuine retention success in the database. Signed up
2026-07-16, did not search until **2026-08-13**, then returned across three days to
2026-08-17. He holds 2 alerts, both matching. **A 28-day dormancy broken after
setting a working alert** is the strongest single piece of evidence that alerts drive
return sessions, and it is n=1.
### F12b. Alert queries are validated, not auto-split (shipped 2026-08-20)

Q9 answered by Kevin: the alert fix jumps the queue ahead of the marketing work.

**Design decision, owner call 2026-08-20.** A comma fan-out was built first (split
"bape, supreme, jerseys" into three searches and union the results). **Kevin rejected
it:** commas should not silently create extra searches. An alert watches one thing,
and the product should say so rather than guess at intent. Reverted and replaced with
validation.

**Shipped:**
- `ALERT_QUERY_SEPARATORS` (`, ; | / & +`) and `findAlertQueryProblem()` in
  `lib/alertConstants.ts`. Dependency-free so client and server share one function
  and cannot drift. **Apostrophes and hyphens are deliberately not separators** —
  "Levi's 501" and "wind-breaker" are real searches.
- `CreateAlertModal.tsx` blocks submit and explains why, naming the offending
  character, plus a one-click "watch just `bape` first" shortcut.
- **Server guard on both routes** (`app/api/saved-searches/route.ts` and
  `[id]/route.ts`) via a zod `.refine()` calling the same function, so the API cannot
  accept what the UI rejects.
- `lib/alertRunner.ts` is back to a single search per alert. **No behaviour change at
  run time**, which is the point: the fix is at creation, not execution.

**Verified:** `scripts/verify-alert-query.mts`, 28 checks, all passing. Covers the
three real broken alerts verbatim, every working alert as a regression guard, real
product names keeping punctuation, every declared separator, and proof the rejected
query was genuinely unmatchable while a single-term one matches. `tsc` and eslint
clean, `verify-sold-comps.mts` still passes (shares `parse.ts`).

**Two consequences that need Kevin's decision, see Q10 and Q11:**

1. **The three existing dead alerts stay dead.** Validation only guards new and edited
   alerts. `romeosd16`, `joseflexis324` and `timothyestigoy24` keep queries that can
   never match, and will keep scraping daily and returning nothing until someone
   edits them. Nothing in this change touches stored rows.
2. **Free tier allows exactly 1 alert** (`TIER_CAPS.free.maxSavedSearches`). Telling
   `romeosd16` to "create a separate alert for each item" means telling him to pick
   one of his four brands. That is either a real paywall with teeth (consistent with
   the monetisation section: alert count and speed as the paid axes) or a reason to
   raise the free cap. It is a pricing decision, not a code one.

**Two of the five broken alerts are NOT addressed by this at all:**

| user | alert | cause | status |
|---|---|---|---|
| japelmathis | `Des vêtements Nike running rare` | **Non-English query against English listing titles.** No separator involved, so validation does not catch it | **Open.** Arguably unfixable without translation |
| koceila.abdelaziz87 | `Sneakers` + clothing size `m` | **Size/category mismatch.** `matchListingSize` tests `m` against `CLOTHING_PATTERNS`; sneaker listings carry a shoe size | **Open.** Fix is UI-side: warn when a shoe-shaped query is paired with a clothing size |

`vespashaw15` (`carhartt wip jacket`, size s, $5-30) is **not a bug** — a genuinely
narrow filter, and zero matches in a week is a plausible honest result.

### F14. The harvester, and what it does not capture (built 2026-08-20)

`scripts/reddit-harvest.mjs`. Node, no dependencies, keyless. Two stages, both
re-implemented in-repo rather than imported from the `last30days` plugin, because
the plugin cache is wiped on update.

- **Discovery:** `https://www.reddit.com/r/<sub>/search.rss?q=...&restrict_sr=1&sort=new`.
  Atom. Post id comes from `<id>t3_xxx</id>` directly rather than a regex over the
  permalink.
- **Comments:** `https://www.reddit.com/svc/shreddit/comments/r/<sub>/t3_<id>?sort=top`.
  Bodies are looked up by `id="{thingId}-post-rtjson-content"` so a nested reply's
  text is never attributed to its parent.

**Three things that had to be got right, all verified on a live thread:**

1. **Reddit double-escapes the post body.** The XML escapes the HTML, and the HTML
   carries numeric entities, so `won&amp;#39;t` needs two unescape passes to become
   `won't`. One pass leaves `&#39;` sitting inside what is supposed to be verbatim
   text. `unescapeEntities` loops to a fixed point, bounded so a literal "&amp;" in
   a post cannot spin.
2. **No truncation.** The reference implementation caps bodies at 300 characters. A
   language file needs the whole sentence.
3. **The element regex needs `<shreddit-comment\s`, not `\b`.** `\b` also matches
   `<shreddit-comment-action-row>` because `-` is a word boundary.

**Verified 2026-08-20** against `r/Flipping` post `1vr9gu4`: title matches the feed,
apostrophes decode correctly, 11 comments parsed, which is exactly the count of
`<shreddit-comment>` elements in the raw HTML, and the same count and top-comment
text an independent parser (the plugin's) produced from the same page.

**KNOWN LIMIT, recorded so nobody mistakes this for a complete capture.** The
comments call returns the **first page only**: top-level comments plus their first
level of replies. Deeper chains sit behind "more replies" controls that lazy-load
separately and are not fetched. On the verified thread that was 11 captured with 4
deferred. Each thread record carries a `deferred_replies` count. For a language file
this is the right trade, since top-scored top-level comments are where people state
a problem plainly and deep chains are usually two users arguing, but it is a real
limit and must not be described as "all comments".

**Operational notes.** 1.5s between requests by default, `--delay` to go slower,
exponential backoff on 429 and 5xx. Reddit did start throttling during repeated
testing, which the backoff handled. Output is NDJSON at
`docs/marketing/audience/raw/`, resume-safe by post id, so an interrupted run
continues rather than re-fetching. **(Archived 2026-09-15: the raw NDJSON was
deleted from this repo as bulky and regenerable — rerun `scripts/reddit-harvest.mjs`
to recreate it. The derived `docs/marketing/audience/language-file.md` is kept.)** The run prints per-subreddit yield and flags any
sub under 20 threads as THIN, which is the plan's volume gate.

### F14b. First real run, and two defects it exposed (2026-08-20)

**Reseller cohort, first pass: 264 threads, 2,880 comments.** No subreddit fell under
the plan's THIN threshold.

| subreddit | threads | comments |
|---|---|---|
| r/Flipping | 72 | 1,113 |
| r/reselling | 91 | 618 |
| r/poshmark | 49 | 647 |
| r/Depop | 52 | 502 |

**r/Flipping, entirely absent from `reddit_research`'s 1,007 rows, is now the
single richest source in the corpus.** That alone justified building this.

**Throttling.** 11 of 24 queries returned zero purely because Reddit rate-limited the
run, and 1 ("did I overpay" in r/poshmark) was a genuine zero. The limit was
self-inflicted, from testing the harvester repeatedly against live pages beforehand.
Retries raised 3 -> 5 and the backoff capped at 120s, because a query that loses its
retries is silently dropped and that is worse than a slow one. A gap-fill pass
re-queries the missed combinations, and resume-by-post-id means it only costs the
gaps.

**Two defects found by inspecting the corpus rather than the code, both now fixed:**

1. **The last comment on every page swallowed the rest of the document.** The body
   window was bounded only by the *next* comment's anchor, and the final comment has
   none, so it ran to end-of-HTML and picked up the Reply/Share UI chrome plus an
   inline `SML.load([...])` script blob. **36 of 2,880 comments were contaminated.**
   Now bounded by the nearest of three markers: next body anchor, next
   `<shreddit-comment>` open tag, next `</shreddit-comment>` close tag.
2. **AutoModerator boilerplate was being captured as user language.** "I am a bot and
   this action was performed automatically" was, before the fix, the single most
   repeated phrase in the entire corpus. It would have poisoned any frequency
   analysis of what people actually say, which is the whole point of the file.
   Now filtered by author and by body pattern.

**How they were found is the transferable part:** neither is visible in the code or
in a spot-check of one thread, which passed cleanly. Both showed up immediately on
running an n-gram frequency count over the whole corpus, which is the first thing the
language file needs anyway. **Frequency-count a corpus before trusting it.**

Verified after the fix by re-parsing a saved page offline (no new requests, since the
run was already throttled): still 11 comments, zero contamination, longest body 512
chars instead of running to end-of-document, top-comment text unchanged.

**Already-harvested data was repaired in place rather than re-fetched**, by cutting
bodies at the UI-chrome boundary and dropping bot comments. The text before that
boundary ends in clean sentences, so nothing real is lost. A full re-harvest with the
fixed parser would be marginally cleaner and is not worth the rate limit.

### F12c. Validation copy is tier-aware (2026-08-20)

Q11's answer exposed a copy bug in the fix from F12b. The blocking message said
"Create a separate alert for each item" to **every** user, but
`TIER_CAPS.free.maxSavedSearches` is **1** — that is advice a free user cannot act on.

Now split by tier, using the `isPaid` state the modal already tracks:

- **Paid:** "Create a separate alert for each item."
- **Free:** "Pick the one you most want to catch." plus "Pro runs unlimited alerts."
  on the shortcut line.

**Copy rule caught in the act:** the first draft read "Pro watches up to 25 at once",
which is true in `TIER_CAPS` but **violates claim C7** — Pro alerts are marketed as
Unlimited and the wording rule is *never pair it with a number*. Corrected to "Pro
runs unlimited alerts." The 25 is an anti-abuse backstop, not a product limit, and
must never appear in UI copy.

**The blocking rule is now load-bearing in two ways**, which is why it stays strict:
it stops a query that could never match, and it stops a free user packing four
watches into the single alert their tier allows.

### F12d. Simplified back down to one message, no tier branching (2026-08-20)

**Owner call, same session as F12c:** "dont let them comma... just say no symbols
like that itll apply to all users no need to make it so complex."

F12c's tier-aware copy and the "watch just X first" one-click shortcut are gone.
`findAlertQueryProblem` now returns only `{ separators }` — no `parts`, no
`suggestion`. The UI shows one line to every user regardless of tier: *"No symbols
like ',' in an alert. Use plain words only."* The server error text
(`saved-searches` routes) was brought in line with the same wording, since it had
drifted to the old "create a separate alert for each item" phrasing.

**Net effect versus F12b's original instinct (auto-split) and F12c (tier-aware
guidance): the simplest version is what shipped.** Block the symbol, say so plainly,
same message for everyone. `scripts/verify-alert-query.mts` trimmed to match — 20
checks, including one that asserts the returned object carries only `separators`
and nothing else, so a future change cannot silently re-grow this. `tsc` and eslint
clean.

### F14c. Both cohorts complete: 1,000 threads, 10,678 comments (2026-08-20)

| cohort | subs | threads | comments |
|---|---|---|---|
| reseller | Flipping, reselling, Depop, poshmark | 451 | 5,157 |
| buyer | Depop, vinted, poshmark, malefashionadvice | 549 | 5,521 |
| **total** | | **1,000** | **10,678** |

No subreddit fell under the THIN threshold in either cohort. r/Flipping alone (116
threads combined across both passes) already exceeds the entire 946-row starting
point `reddit_research` had when Step 0 was first drafted, and it is a subreddit
that table has never touched.

**Contamination check re-run on the buyer file with the fixed parser (F14b):** zero
`SML.load`, zero AutoModerator boilerplate, zero HTML entity leakage. One n-gram
spike worth recording so it does not get mistaken for a defect later: `format pjpg
auto webp` / `preview redd it`, ~30 occurrences. **Not corruption** — verified by
inspection, it is people literally pasting `https://preview.redd.it/...jpg?...`
image links into their own post bodies (attaching photos of what they're selling or
asking about). Real, verbatim, correctly captured. It is noise for a *language*
file, not a parsing bug, so it gets filtered when the file is written, not fixed in
the harvester. Same story for the two "HTML tag" hits across both cohorts: both are
humans typing literal `<insert brand>` / `<three blurry photos>` as placeholder
text, not markup leakage.

**Ready for phase 3.** Next: extract the language file (grouped verbatim quotes)
and the single-person profile from this corpus.

### F15. Language file and profile written; the audience axis itself was wrong

`docs/marketing/audience/language-file.md` and `profile.md` are written from the
1,000-thread corpus. Built by targeted keyword search across the flattened corpus,
hand-read and curated (not a raw dump), organized under the article's five buckets.
**5 spot-checked quotes verified word-for-word against the raw NDJSON before
trusting the file** — all 5 matched exactly.

**The central finding overturns the framing question itself, not just answers it.**
F2c already found buyer and reseller queries are indistinguishable. The Reddit
corpus explains why: the search-is-bad complaint and the manual
Google-plus-cross-platform-checking workaround were found **independently in both
cohorts**, in near-identical language. A reseller sourcing to flip and a buyer
hunting a piece hit the same wall.

**So the profile does not pick buyer or reseller. It defines the person by the
moment — someone who already knows what they want and is being failed by one
platform's search — not by their downstream intent.** This does not resolve Q2 (Kevin
still decides), but it gives a third option neither `COMPETITIVE_POSITIONING.md`
section 4 nor F2b's engagement data argued for on their own.

**A hard constraint the profile establishes for every hook going forward:** the
loudest emotion in the entire corpus is scam/trust fear, and it is explicitly a pain
Crawli does not solve (no authentication, no seller verification). Leading a hook
with safety or scam-avoidance would violate the article's own rule — "a hook you
can't pay off is worse than a weak hook" — and must be screened out in phase 5.

**Also established, useful for hook voice:** this audience never says "price
comparison" or "cross-platform search" — they describe the failure ("impossible to
find anything in the search") and their own workaround ("I search on Google
instead"), never the product category. And the tone is chronic low-grade annoyance,
not crisis — most quotes read as tired, not desperate, which argues against
urgency-driven hooks and toward "here's the annoying thing solved" hooks.

### F16. Two of the three active channels have never produced a single measurable number

`docs/marketing/audience/channels.md` written. Reddit subreddit ranking used real
engagement pulled from the harvest itself (unique commenters, comment scores) after
three attempts at getting subscriber counts all failed: the `.json` API 403s (known,
F3), the rendered subreddit page serves an empty JS shell over plain HTTP, and
**Playwright hit Reddit's bot-check interstitial** navigating the page directly —
not something to push through. **Recommendation: r/Flipping + r/poshmark** — the
former is where this audience already thinks in sold-comps terms natively
(language-file §1), the latter has the highest raw engagement of the six and (per
`profile.md`) is not cleanly buyer- or reseller-coded.

**The real finding is about the three channels already in use (TikTok, IG, YouTube
Shorts).** TikTok has a real table (`tiktok_performance`) and real evidence (F11:
the only content that has ever visibly moved signups). **Instagram and YouTube
Shorts have never produced a single logged number, ever** — not "unmeasured this
session," unmeasured since either channel started. The plan's Phase 4 goal was "pick
two and drop the rest" — that cannot be honestly done here. Ranking IG/Shorts against
TikTok would be inventing a comparison. Naming this rather than forcing a false pick
is the point of the checkpoint discipline this whole plan runs on.

**Open for Kevin:** build lightweight IG/Shorts tracking (matching
`tiktok_performance`'s shape) before or after phase 5's hooks ship? Shipping hooks to
all three channels with no way to read two of them repeats the exact gap
`GROWTH_PLAN.md` already diagnosed in the June TikTok burst (55 posts, no
UTM/referrer attribution, unreadable after the fact).

### F16b. Channel strategy simplified: TikTok is the only channel with independent creative

Kevin, 2026-08-20: "well be focusing on tiktok but reels and yt shorts are just
gonna be reposts of the tiktok."

This changes the shape of F16's open question rather than answering it as asked.
Building IG/Shorts tracking was framed as "before or after phase 5" on the
assumption those channels would carry their own creative decisions eventually — a
hook that wins on IG but not TikTok, for instance. **That assumption is now
explicitly false.** IG and Shorts get whatever wins (or ships) on TikTok, unedited.
There is no independent variable on those channels to measure, so no independent
measurement is needed. TikTok's read is the only read that matters.

**Practical effect on phase 5:** every hook, every variant, every A/B is designed
and evaluated for TikTok only. Reposting to IG/Shorts happens after the fact as
distribution, not as a parallel experiment.

### F17. Idea triage and first hook batch written; caught my own stale-data error

`docs/marketing/audience/idea-triage.md`. All ~25 backlog ideas plus feedback notes
triaged into KEEP / NEEDS REWRITE / LOWER PRIORITY / DROP against `profile.md` and
the §6b claim ledger. Two SEO/blog ideas dropped outright per the standing
no-blog-posts instruction (not a judgment call). One idea dropped for insufficient
context ("funny collections vid, making fun of the dude") rather than guessed at.

**Four ideas given full hook treatment — 15 hooks each, 60 total, every hook checked
against §6b:**
1. **Sold comps vs. asking prices** — new, sourced directly from language-file §1's
   own "asking prices are not comps" thread. Strongest candidate: the corpus already
   wrote the thesis.
2. **Copy their style, find the real price** — matches `profile.md`'s defining
   moment exactly.
3. **Pure feature demo (search → sold comps → flip calc)** — show-don't-tell,
   matches the audience's stated preference for checkable claims over hype
   (language-file §3/§5).
4. **Fees, explained** — rehook of your existing script/post (121 views, 2026-08-12,
   verified against `tiktok_performance` before citing it).

**Two wording flags caught during the hook pass, both from checking code, not
memory:** "what it actually sold for" only holds for Grailed under C1 — several
draft hooks needed the caveat attached. And naming a specific platform as "worse
than the rest" (two draft hooks in the style idea) was flagged as a same-day-wrong
risk and softened to generic phrasing.

**I made and caught my own stale-data error while flagging Idea D's fee figures.** I
initially wrote "verify before reposting, `lib/marketplaceFees.ts` verified
2026-06-28, two months old" — that figure came from a HANDOFF.md excerpt read at the
*start* of this session, before the 2026-08-11 Pro-repricing work touched that file.
Checking the actual code (`FEES_LAST_VERIFIED`) instead of the doc found it was
reverified 2026-08-11, 9 days ago. Went further and checked every specific number
used in the fee hooks (Poshmark 20%/$2.95 threshold, Depop's $0-commission-but-not-
$0-fees structure, eBay 13.6%, Vinted's seller-side $0, Grailed's tiered 6%/9%)
against the live `marketplaceFees.ts` rows directly — all accurate, no hook needed a
rewrite. **The lesson: a doc excerpt read early in a long session is a snapshot, not
a live value — check the code before shipping a specific number, especially after
other work has touched the same file mid-session.**

**Obfuscation-rule experiment (D2) designed, not yet shipped.** Each of the four
ideas' top hook gets a soft and an explicit-CTA variant. Kill criterion: explicit
must beat soft on comments-per-post across at least 2 of 4 ideas or revert to soft
only. Not logged in `COMPETITIVE_POSITIONING.md` §6c yet — §6c logs experiments as
they post, not as they're planned.

**Five ideas deliberately held back** (fee-listicle variants, the newly-viable
alert-fix angle, three series-format ideas) rather than writing 45 more hooks before
the first four have any result — matches the article's "test two of everything," not
everything at once.


---

## Locked decisions

Recorded so a future session does not reopen them without cause.

| # | Decision | Date | Reason |
|---|---|---|---|
| D1 | Decide the audience on evidence, not assertion | 2026-08-19 | Step 0 was skipped; F1 and F2 make it cheap to answer now |
| D2 | The obfuscate-commercial-intent rule is lifted, and soft vs explicit CTA becomes a logged experiment | 2026-08-19 | It produced 0 comments across 55 posts, failing its own KPI; `COMPETITIVE_POSITIONING.md` section 6d point 4 already instructs revisiting it; F6 shows it is already dead in practice |
| D3 | Harvest posts **and** comments, focused subreddit set | 2026-08-19 | Comments carry the verbatim language; F4 rules out the quota-limited path |
| D4 | Do not email users the Step 0 question | 2026-08-19 | Owner preference, and F1 shows onboarding already collects it |

---

## Open questions

| # | Question | Blocked on | Raised |
|---|---|---|---|
| Q1 | ~~Does the reseller depth advantage in F2 survive dropping the heaviest single user?~~ | **ANSWERED 2026-08-19: no.** It was entirely the owner's account. See F2b | 2026-08-19 |
| Q2 | **Buyers are more numerous AND more engaged (F2b), which contradicts the section 4 reseller position.** Does the product follow the users, or keep chasing resellers? | **DEFERRED 2026-08-25 by Kevin: leave it for now, more users are still coming in.** Revisit once signup volume gives this a real answer | 2026-08-19 |
| Q3 | ~~Is Instagram and Shorts tracking worth building, or do we accept TikTok as the only measurable channel?~~ | **ANSWERED 2026-08-20 via Q12: neither — IG/Shorts carry no independent creative decision (straight reposts of TikTok), so there's nothing separate to track.** Same answer, reached twice; see F16b | 2026-08-19 |
| Q4 | ~~What do people actually check before buying something to flip?~~ | **ANSWERED 2026-08-25 — this was never blocked on Kevin, it was blocked on the Phase 3 harvest, which finished 2026-08-20. Answer was sitting in `language-file.md` §2, just not yet synthesized into a direct answer.** In order of frequency: (1) sold price history, by far the dominant theme — the "asking prices are not comps" thread; (2) identification via reverse image search when unsure what the item is; (3) cross-referencing a niche-specific pricing tool alongside general search | 2026-08-19 |
| Q5 | ~~Are the three 0-view TikTok posts real zeros, or a Zernio reporting gap?~~ | **DROPPED 2026-08-25 by Kevin: not worth pursuing.** | 2026-08-19 |
| Q6 | ~~Is the reseller-branded onboarding step pulling its weight?~~ | **ANSWERED 2026-08-25, DB checked live at Kevin's request.** Users who signed up after the persona branch shipped (2026-07-16), owner excluded: buyers complete onboarding 96% of the time (22/23) vs resellers 82% (9/11) — resellers drop out more, though n=11 is thin. Downstream, resellers don't out-search, out-alert, or out-save buyers either (1.0 vs 1.6 avg searches, 36% vs 39% set an alert, saves are ~0 in both). **The reseller-specific TailStep prompt doesn't complete better and doesn't produce more engaged users — no number supports keeping it as-is.** See F10 note and Q8 | 2026-08-19 |
| Q7 | **How do you charge people who are only buying for themselves?** The paid features (sold comps, flip margin) answer a seller question, and F9 shows nobody has ever paid | **Kevin.** Analysis in "The monetisation problem" below | 2026-08-20 |
| Q8 | ~~Is the 2026-05-25 cohort (F10) hand-seeded friends?~~ | **CONFIRMED 2026-08-25 by Kevin: "probably yes the first 8 are me and friends."** Saves/tracked-listings have a confirmed organic adoption count of 0 — see updated F10 | 2026-08-20 |
| Q9 | ~~Does the alert fix jump the queue ahead of marketing work?~~ | **ANSWERED 2026-08-20: yes.** Shipped as validation, see F12b | 2026-08-20 |
| Q12 | ~~Build IG/Shorts tracking before or after phase 5?~~ | **ANSWERED 2026-08-20: TikTok is the focus; IG Reels and YT Shorts are straight reposts of whatever ships on TikTok, no separate creative.** Since they carry no independent decision, no separate tracking is needed either — TikTok's read is the read | 2026-08-20 |
| Q10 | ~~The 3 existing dead alerts still have unmatchable queries.~~ | **ANSWERED 2026-08-20: leave them.** No backfill, no outreach. They stay dead until their owners edit them | 2026-08-20 |
| Q11 | ~~Free tier is 1 alert. Is that the paywall working, or does the cap need raising?~~ | **ANSWERED 2026-08-20: the cap holds at 1, and commas must not become a workaround for it.** Blocking a comma list is doing two jobs at once: it stops an unmatchable query, and it stops a free user packing several watches into their one alert. First shipped as tier-aware copy (F12c), then **simplified back to one message for every user, no tier branching** — see F12d | 2026-08-20 |

---

## The monetisation problem: how do you charge buyers?

Raised by Kevin 2026-08-20, tracked as Q7. The tension is real: F2b says the users
are buyers, and the entire paywall is built around a seller's question.

### What is actually gated today

`canSeePriceIntelligence()` in `lib/tierCaps.ts` gates the **price summary, sold
comps and flip margin**. The governing line is *"free shows you listings, Pro tells
you what they mean."* Every one of those three answers a **selling** question: what
did it go for, what is my margin, what should I list at.

A buyer hunting a piece for themselves does not have that question. They have two
others:

1. **"Will I miss it?"** The good listing is gone in hours.
2. **"Is this price a rip-off?"** Not "what is my margin", just: is 180 a lot for this.

### The lever that is sitting unused

`minAlertCadenceHours` is **24 on every single tier** — free, pro and max
(`lib/tierCaps.ts:82-84`). Alert *speed* is not sold at all. Alerts are gated by
count only.

For a buyer, **speed is the entire product.** "I will tell you within the hour when
the thing you want appears at your size under your price, across 8 marketplaces" is a
different proposition from search, and it is not something Gem or Beni offer. The
section 4 argument that "buyers will not pay for search when Gem is free" is correct
and does not apply here, because this is not search.

It is also honestly priceable: faster cadence costs more to serve, so charging for it
is not an artificial gate. And the infrastructure already supports it. Alerts never
touch Firecrawl (`ALERT_EXCLUDED_PLATFORMS` excludes eBay, the only metered
platform), `lib/searchCache` fans one scrape out to every user watching the same
query, and the cron ticks every 15 minutes with roughly 1920 runs/day of headroom
against 13 live alerts. The floor logic is already driven off
`caps.minAlertCadenceHours`, so this is a constant change, not a feature build.

### The reframe that costs almost nothing

Sold comps may already be a buyer feature wearing seller clothing. The same median
that tells a reseller their margin tells a buyer whether the asking price is
sensible. That is a **copy and framing change**, not a product change, and it is the
cheapest thing on this list to test.

Constraint: the claim ledger still binds. C1 forbids naming Mercari, forbids implying
one blended cross-platform price, and forbids "what it actually sold for" about
Poshmark.

### What NOT to do

**Do not add affiliate revenue.** Section 4 rules it out, the unit economics are
publicly bad, and it forfeits claim C2 ("we're paid by you, not by the marketplaces
we rank") — the one piece of positioning that is both true and structurally
defensible against Beni. The Phia cookie-stuffing coverage in section 7 is what that
road looks like from outside.

### The honest caveat, which matters more than any of the above

**At 59 users and zero non-owner conversions ever (F9), pricing is not the binding
constraint.** No pricing experiment is readable at this n. Three humans have ever
reached Stripe and none completed.

What the data actually says is upstream of price: people arrive, run one search, and
leave. The single exception is `jonahkatsumata`, who went dormant for 28 days and
came back across three days after setting **an alert that worked** (F13).

And a third of alerts **cannot** work (F12).

So the sequence the evidence supports is:

1. **Fix F12** (OR semantics for multi-brand alerts, non-English handling, size/category
   mismatch). This is the only change with direct evidence behind it: the one user who
   retained is the one whose alert matched.
2. **Then make alert speed the paid axis**, because by then alerts will actually fire.
3. **Then** reframe sold comps for buyers, which is nearly free to try.

Charging buyers is a solvable problem. It is just not the problem that is currently
costing the most.

---

## Progress log

Newest last. One line per meaningful step.

- **2026-08-19** Phase 0 done. Doc created. Findings F1 to F8 loaded from a live
  verification pass: Reddit RSS and shreddit tested against real threads, Supabase
  queried for persona split and TikTok monthly shape, Zernio ruled out on the
  documented throttle, `reddit_research` characterised.
- **2026-08-19** Phase 1 done, and **it overturned the headline finding.** The
  reseller "6x deeper" read (F2) was one account: the owner's own Pro profile, 51
  searches and 167 saves against a cohort of 7 others averaging 0.75. Excluding it
  (F2b), buyers beat resellers on activation (87% vs 57%), alert adoption (53% vs
  14%) and second-day return (2 vs 0). Also found that query shape is identical
  across personas (F2c) and that nobody but the owner has ever saved anything.
  Corrected F7: the TikTok sync is healthy and weekly, not stale; the real gap is
  that Instagram and Shorts are untracked entirely. Q1 answered, Q5 and Q6 opened.
- **2026-08-20** Independent re-analysis of the persona data, deliberately not
  inheriting the framing of the earlier passes or of the older docs. Went back to raw
  tables and clustered on behaviour rather than declared persona. Five new findings,
  F9 to F13. The headline is **F12: 36% of real user alerts can never match anything**,
  confirmed at code level (`lib/parse.ts:156` requires a title to contain every anchor
  token, and comma-separated brand lists survive punctuation stripping as separate
  anchors). Also: zero real paying customers ever (F9), every deeply engaged non-owner
  user arrived on one day in May (F10), signups have accelerated ~5x in August (F11),
  and alert emails are read by essentially one person (F13). Q7, Q8, Q9 opened.
- **2026-08-20** Q9 answered: fix jumps the queue. First built a comma fan-out
  (auto-splitting a list into separate searches). **Owner rejected it** — commas
  should not silently create extra searches. Reverted and reshipped as validation:
  `findAlertQueryProblem` in `lib/alertConstants.ts`, blocking UI in
  `CreateAlertModal`, and a zod guard on both saved-searches routes so the API
  cannot accept what the UI rejects. `scripts/verify-alert-query.mts`, 28 checks,
  tsc and eslint clean. Q10 and Q11 opened: the 3 existing dead alerts are not
  backfilled, and the 1-alert free cap now bites. Not committed — owner commits.
- **2026-08-20** Phase 2 done. Built `scripts/reddit-harvest.mjs` and verified its
  parse against a live r/Flipping thread (11 comments, matching both the raw HTML
  element count and an independent parser). Documented the first-page-only comment
  limit as F14 rather than implying a complete capture. First reseller run brought
  back **264 threads and 2,880 comments**, with r/Flipping the richest source. An
  n-gram pass over the corpus exposed two parser defects a single-thread spot-check
  had missed (last comment swallowing the page, AutoModerator boilerplate counted as
  user language). Both fixed and verified offline, existing data repaired in place.
  See F14b. Gap-fill and buyer cohort running.
- **2026-08-20** Q10 and Q11 answered. Dead alerts: left alone. Free cap: holds at 1,
  and comma-blocking is confirmed as the guard against using one alert as several.
  Made the validation copy tier-aware (F12c) after realising it told free users to do
  something their tier forbids, and caught a C7 violation in my own first draft of
  that copy ("up to 25" where the sanctioned wording is "unlimited").
- **2026-08-20** Owner simplified F12c away: one message, no tier logic, no
  suggested fix. `findAlertQueryProblem` trimmed to `{ separators }` only. See F12d.
- **2026-08-20** Buyer cohort harvest completed: **549 threads, 5,521 comments**
  (r/Depop, r/vinted, r/poshmark, r/malefashionadvice). Combined with the reseller
  cohort: **1,000 threads, 10,678 comments total.** Re-ran the contamination check
  from F14b on the buyer file with the fixed parser — clean (zero `SML.load`, zero
  bot boilerplate, zero entity leakage). The one n-gram spike found (`preview redd
  it` / `format pjpg`) was verified as real pasted image URLs, not a parser bug. See
  F14c.
- **2026-08-20** Phase 3 files written and quote-verified: `language-file.md` (5
  buckets, verbatim quotes with permalinks) and `profile.md`. 5 quotes spot-checked
  word-for-word against the raw NDJSON before trusting the file — all 5 matched
  exactly. Central finding: the buyer/reseller axis itself doesn't hold up — both
  cohorts hit identical search-is-bad and comps-are-unclear pain, described in
  near-identical language, so the profile defines the person by the moment (search
  failing them right now) rather than by persona. See F15.
- **2026-08-20** Kevin read `profile.md`: "read profile and i like the information."
  Checkpoint cleared.
- **2026-08-20** Kevin: "well be focusing on tiktok but reels and yt shorts are just
  gonna be reposts of the tiktok." This reframes F16 rather than answering it as
  asked — IG/Shorts carry no independent creative decision, so no independent
  measurement is needed either. TikTok's read is the only read that matters. See
  F16b. Q12 closed.
- **2026-08-20** Phase 5 first pass written: `idea-triage.md`. Full ~25-idea backlog
  triaged against `profile.md` and the §6b claim ledger. Two SEO/blog ideas dropped
  per standing instruction, one idea flagged rather than guessed at for insufficient
  context. Four ideas given full 15-hook treatment (60 hooks total). Caught and
  corrected my own stale-data error while flagging Idea D's fee figures — an early-
  session HANDOFF excerpt said "verified 2026-06-28," but checking
  `lib/marketplaceFees.ts` directly showed it was reverified 2026-08-11, after the
  Pro-repricing work touched that file mid-session. Every specific number in the fee
  hooks then checked against the live file directly — all accurate. See F17. Five
  more triaged ideas held back for the next batch rather than writing 45 more hooks
  before these four have a result. **Kevin checkpoint: awaiting his read of the
  hooks.**
- **2026-08-20** Kevin corrected the "source and list correctly" flag in
  `idea-triage.md`: Crawli doesn't post or crosslist a listing, but sold comps + flip
  margin directly inform what to charge and where to list — that IS real listing
  input, not just sourcing. My original flag overcorrected by saying "Crawli doesn't
  help you list" at all. Fixed: that idea is no longer flagged as an overclaim, just
  reworded for precision ("know what to charge when you list," not "list for you").
  **Note for future sessions: this turn found that several earlier progress-log
  append attempts (buyer-cohort completion, checkpoint approval, F16b, F17) had
  silently failed to land — the Locked Decisions sections landed but the
  chronological log entries didn't, likely an anchor-text collision across chained
  edits. Reconstructed and appended above. Verify an append actually landed
  (grep for it) before trusting it happened, don't just trust the edit call
  succeeding.**
- **2026-08-25** Kevin followed up on the six open questions. Q2 deferred (leave it,
  more users are still coming in). Q4 answered — it was never actually blocked on
  Kevin, it was blocked on the phase 3 harvest, which finished 2026-08-20; the answer
  was sitting in `language-file.md` §2 the whole time, just not synthesized into a
  direct answer until Kevin asked "what are we waiting on me for?" **Step 0 is now
  fully closed**, both its questions answered. Q5 dropped, not worth pursuing. Q6
  re-scoped after checking the actual code rather than trusting the earlier
  phrasing: `onboarding_persona` is not decorative, it branches real onboarding UI
  (`TailStep.tsx`, `SeedStep.tsx`) — the open question is narrower than "is this
  question pointless," it's whether that specific branch is pulling its weight given
  F2c/F15. Q7 and Q8 re-explained, unchanged. Still open for Kevin: Q6, Q7, Q8, and
  a read of the hooks in `idea-triage.md` (no explicit feedback given yet).
- **2026-08-25** Kevin followed up on Q6/Q7/Q8 and confirmed reading the hooks.
  **Q6** answered with a live DB check at his request rather than more analysis:
  post-2026-07-16 signups, owner excluded — buyers complete onboarding 96% (22/23)
  vs resellers 82% (9/11), and resellers don't out-search, out-alert or out-save
  buyers afterward either. No number supports the reseller-branded TailStep prompt
  earning its current place. **Q7** re-explained in plain terms after Kevin said he
  still didn't follow it — dropped the doc jargon, explained as "you only charge for
  a seller question, most users aren't sellers, here are two concrete fixes and why
  neither matters yet at 1 real paying customer." **Q8 confirmed**, not just
  inferred: "probably yes the first 8 are me and friends" — F10 updated from
  inference to settled fact, saves/tracked-listings organic adoption is a confirmed
  0, not a suspected one. Kevin read `idea-triage.md`; no specific feedback given
  either way, logged as read-not-objected-to rather than approved. Still open: Q7
  itself (re-explained, decision still pending).
