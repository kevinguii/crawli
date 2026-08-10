# Crawli — Competitive Positioning vs the Recommerce Aggregator Landscape

**Created:** 2026-08-07 · **Last updated:** 2026-08-10 · **Owner:** Kevin · **Status:** decision doc

Companion to `docs/planning/GROWTH_PLAN.md`. GROWTH_PLAN answers "how do we get
distribution." This doc answers the prior question: **is the category Crawli is
currently in winnable, and if not, which adjacent one is.**

Crawli numbers pulled live 2026-08-07 (Supabase `peyqxfijdrziqfjkxjsn` + GSC
`thecrawli.com`). Competitor numbers are cited to public sources in §7.

**§6 is the live section.** Sections 1-5 are analysis; §6 gates what marketing is
allowed to claim and records every experiment. Read §6b before writing any copy.

---

## Where things stand

| Work | State |
|---|---|
| **Step 0 — audience validation** | **not started.** Blocking gate on Step 1. |
| **Step 1 — sold comps (Poshmark/Mercari/Grailed)** | **not started.** The product gap. Largest remaining item. |
| Step 2 — alert CTA prominence | shipped 2026-08-10 · EXP-002 running |
| Step 2 — compound criteria surfaced | shipped 2026-08-10 · folded into EXP-002 |
| Step 2 — baseline email on first alert run | shipped 2026-08-10 · EXP-003 running |
| **Step 2 — onboarding flow for new signups** | **deferred 2026-08-10, not built** · EXP-001 |
| **Step 2 — public alert creation** | **deferred + gated** on EXP-001 and EXP-002 · EXP-005 |
| Step 3 — stop writing blog posts | standing instruction |
| **Step 4 — rewrite positioning** | **blocked on Step 1** |

---

## 1. Where Crawli actually stands

| Signal | 2026-06-30 (GROWTH_PLAN) | 2026-08-07 | Read |
|---|---|---|---|
| Total users | 19 | **36** | Signups nearly doubled |
| Paying subs | 0 | **1** (max, active) | First revenue ever |
| New signups (30d) | 10 | **17** | ~0.57/day, improving |
| Signed in last 7d | 3 searchers | **7** | Slight warming |
| Lifetime searchers | 13 | **26 / 36 (72%)** | Activation still good |
| Searches per searcher | 7.3 | **4.7** | Falling — new cohort is thinner |
| Searches last 30d | — | **26 across 14 users** | **~1.9/user/month** |
| Users with saves | 4 | **4** | Unchanged in 5 weeks |
| Users with alerts | 2 | **2** | Unchanged in 5 weeks |
| GSC impressions | ~150/day | ~160/day | **Plateaued** |
| GSC clicks (90d) | — | **39 total, 0.48% CTR** | 8 of those are brand term |

### The four findings that matter

**1. Nobody is near a paywall.** Free tier is 5 searches/week (~20/month). Actual
usage is 1.9 searches/user/month. There is no scarcity, so there is no conversion
pressure. The pricing page is not the bottleneck — demand is.

**2. Retention features are inert.** Saves sit at 4 users and alerts at 2 users,
both unchanged while the user base doubled. Every new user since late June has
searched and left without adopting a single sticky feature. 10 of 26 searchers
searched exactly once, ever. Only 7 of 26 ever came back on a second day.

**3. Users are not doing what the positioning says.** Actual queries from
`search_history`: `Xbox 1 s`, `phone`, `resident evil coins`, `assassins creed
tankard`, `Panties`, `Nike revolution 2`, `chanel maxi flap bag`, `Loewe puzzle
bag`, `Hermes`. These are **buyer** queries, and a meaningful share are **not
fashion at all**. The site is positioned as cross-platform price comparison that
also serves resellers (`B2B_FEATURE_TRUTH.md` §5). What people are doing with it
is general secondhand meta-search.

**4. The SEO program is not converting.** 116 blog posts and 33 compare pages
produce 8,203 impressions over 90 days and 39 clicks. Compare pages specifically:
696 impressions, average position ~9, **zero clicks**. The single best blog page
(`best-secondhand-marketplaces-for-luxury-items`) has 1,044 impressions and zero
clicks at position 15.7. The AI-Overview zero-click ceiling diagnosed 2026-07-17 is
real and did not move after the AIO-citability rewrite. Adding more posts is the
lowest-ROI activity available.

### A caveat on reading `search_history`

`search_history` upserts on `search_history_dedupe (user_id, query, platforms,
filters)`. An identical repeat search does **not** add a row — it bumps
`searched_at`. So row counts per (user, query) count *distinct platform/filter
variants*, not repeats, and the table has never recorded how many times a search was
actually run. **Do not derive repeat-search behaviour from it.** Full note in
`docs/core/PITFALLS.md` → Payments + Supabase.

---

## 2. The landscape, compressed

The market splits into two segments that are usually conflated. They are different
businesses with different buyers and different economics.

### Segment A — Buyer-side recommerce aggregators (discovery)

| Player | Model | Coverage | Monetization | Key asset |
|---|---|---|---|---|
| **Beni** | Extension + iOS + web, passive interception at the retail product page | ~50 marketplaces, ~200M listings via direct feeds/APIs, 2,000+ retail site integrations | Affiliate CPA | $6.26M raised; Beni Lens visual search (Dec 2025); Google Cloud/Vertex AI stack |
| **Gem** | Standalone web + app, active search | 14+ named marketplaces **plus hundreds of independent stores**; image search; real-time alerts; decade/location filters | Affiliate | Since 2019; deepest vintage/indie long tail; alerts are real-time vs Beni's daily batch |
| **Faircado** | Extension | EU-focused | Affiliate | Regional moat |
| **Phia** | Extension | 300M items | Affiliate | **Suspended from Impact.com July 2026** over cookie-stuffing; $43.5M raised, reputationally damaged |
| **Crawli** | Web app, active search | **9 platforms**, live on-demand scrape, no index | **Subscription** | Compound alert criteria; verified fee/margin calc; no affiliate exposure |

### Segment B — Sell-side / reseller sourcing tools

| Player | What it does | Price |
|---|---|---|
| **Underpriced AI** | Scan an item, get **real sold comps** across eBay/Poshmark/Mercari (+ Etsy/Depop/FB), sell-through rate, days-to-sell, fee/take-home calc. Mobile-first for in-store sourcing. | from $2.99/mo, 10 free scans |
| **Vendoo / List Perfectly / Flyp / Voolist / PalmFlow** | Cross-listing, inventory, delisting | $10-50/mo |
| **Flipwise** | eBay bookkeeping / P&L | subscription |
| **Terapeak (eBay native), WorthPoint** | Sold-price history | free w/ eBay store / $29.99/mo |
| **Crawli** | Live listing prices across 9 platforms + verified fee calculator | $10-30/mo |

---

## 3. Honest verdict

### Where Crawli cannot win: Segment A, as currently built

Against Beni and Gem, Crawli is behind on **every axis that matters to a buyer**,
and the gaps are structural, not effort-gaps:

- **Coverage.** 9 platforms vs ~50 (Beni) and 14+ named plus hundreds of indie
  stores (Gem). This gap cannot be closed by scraping harder. Beni's is built on
  negotiated direct feeds and API access; Gem's indie long tail is a seven-year
  crawl-and-curate accumulation.
- **Latency and modality.** Beni and Gem query a pre-indexed corpus and return in
  milliseconds. Crawli scrapes on demand at ~35s/platform. That is fine for an
  alert and unacceptable for browse-shopping.
- **Surface area.** Beni: extension + iOS + Safari mobile extension + web + visual
  search. Gem: web + iOS + Android + image search + real-time alerts. Crawli: one
  web app behind a signup wall.
- **Distribution.** Beni intercepts at the moment of purchase intent on 2,000+
  retail sites. Crawli's only inbound is a blog at 0.48% CTR.

A shopper comparing Crawli to Gem picks Gem in every scenario. No amount of copy
fixes that.

### Where Crawli is not actually behind

**1. No affiliate dependency.** Beni's own CEO has publicly named the problem:
affiliate revenue per transaction in resale is low and the model requires enormous
scale. Compounding it, eBay Partner Network runs a 24-hour cookie window, brutal for
auction listings. Crawli's subscription model does not care about attribution
windows, does not fight for last-click credit, and cannot be suspended from
Impact.com. Post-Phia, "we never touch your affiliate cookies and we are not paid by
the marketplaces we rank" is a live trust position.

**2. Scraping covers platforms that will not partner.** Beni's partner list skews
P2P and managed consignment (Poshmark, eBay, Depop, ThredUp, RealReal, Vestiaire).
Crawli natively covers **Grailed, Vinted, StockX** — streetwear/EU/sneaker inventory
thinner or absent in the feed-partnership world. Narrow, but real.

**3. Compound alert criteria + shared-scrape economics.** `applyCriteria()`
(`lib/alertRunner.ts`) narrows an alert by **size AND a price range**, on top of the
query that carries brand and keywords. Beni batches alerts daily; Gem does real-time
but without compound criteria. And `withListingsCache` fans one scrape out to N
users watching the same query, so alerts have far better unit economics than one-off
search. Alerts are Crawli's cheapest and most defensible feature, and they are
adopted by 2 users.

### The gap that decides this

**Crawli has no sold-comps data.** Search returns live asking prices only.
`isSold` exists in the codebase but only ever to *discard* — `lib/parse.ts:171`
filters sold listings out of results, and `app/api/watchlist/refresh/route.ts:83`
marks a tracked listing gone. Historical sale prices are never aggregated or stored.

For a buyer, asking price is fine. **For a reseller deciding whether to buy, asking
price is close to worthless** — what matters is what the item actually sold for and
how fast. That is exactly what Underpriced AI sells for $2.99/mo, and it is why
resellers pay for tools at all. Crawli currently charges $10-30/mo for strictly less
decision-relevant data than a $2.99 app.

---

## 4. Recommended position

> **Crawli is the cross-platform sold-price engine for people who buy secondhand to
> resell. Not an affiliate. Not a shopping extension. A paid instrument.**

- **It is the only segment where the architecture is an advantage.** On-demand
  scraping is a liability for browse-shopping (too slow) and an asset for
  comp-checking (fresh, and reaches platforms without feed partnerships).
- **It is the only segment where a subscription is rational.** Buyers will not pay
  for search when Gem is free. A reseller will pay $20/mo for a tool that pays for
  itself on one flip. The existing single Max subscriber is the proof of concept.
- **Beni structurally cannot follow.** Their revenue is CPA on the buy click.
  Sell-side tooling generates no affiliate event, and eBay sold data is not
  something an affiliate relationship grants. Building it would compete with their
  own economics.
- **Gem will not follow.** Consumer vintage discovery, founder-led, no pressure
  toward pro tooling.
- **Underpriced AI is the real competitor**, and it is beatable on platform
  breadth: it grounds in eBay/Poshmark/Mercari, while Crawli already scrapes
  Grailed, Vinted, StockX, Vestiaire, Depop and ThredUp natively.

The buyer-side price-comparison framing in `B2B_FEATURE_TRUTH.md` §5 gets
**narrowed, not widened.**

### The unresolved tension

Current users search like buyers, not resellers. Two readings with different
consequences:

- **(a)** The current 36 are the wrong cohort, pulled in by blog content about
  vintage fabric and luxury handbags rather than anything reseller-shaped. The
  position holds and the audience needs replacing.
- **(b)** There is no reachable reseller demand for this, in which case the honest
  move is to stop paying for the product and treat it as a portfolio piece.

**Step 0 exists to settle this before any code gets written.** Building sold comps
on reading (b) wastes a month.

---

## 5. What is left to do

### Step 0 — Settle the audience question · NOT STARTED

The entire plan branches on this. Cost: a few hours, no code.

1. Email all 36 users individually (36 is small enough to do by hand, and
   hand-written converts). One question: *"Are you buying this stuff for yourself,
   or to resell?"* Second question for resellers: *"What do you check before you buy
   something to flip?"*
2. Post the same question in r/Flipping, r/SneakerDeals, r/Depop, r/poshmark. Not a
   pitch. A question. The `reddit_research` table has 946 rows of scraped sentiment;
   this is the missing primary-source layer.
3. **Gate:** if fewer than 5 of 36 are resellers *and* the Reddit threads show no
   pull for cross-platform sold comps, stop and re-open the strategy. Do not proceed
   to Step 1 on optimism.

### Step 1 — Ship sold comps · NOT STARTED

The one feature that changes what Crawli is. Scope it small.

**Scope: Poshmark + Mercari + Grailed ONLY. eBay and StockX are out of scope.**
Owner decision. Do not add them back without an explicit decision.

**Why these three:** each builds its search URL from a plain query param
(`poshmark_search_url` → `/search?query=…&type=listings`, `mercari_search_url` →
`/search/?keyword=…`, `grailed_search_url` → `/shop?query=…`). Sold comps here is a
URL-param change plus a DOM check.

**What sold detection exists today.** The two layers behave oppositely, which is why
broad detail-layer coverage does not make this feature free:

| Layer | File | Sold detection |
|---|---|---|
| **Listing detail** (watchlist refresh, one URL at a time) | `structured_extractors.py` | **7 platforms**: Depop, Grailed, ThredUp, eBay, Vestiaire (shared JSON-LD `_availability_is_sold`), Poshmark (JSON-LD, 12/12 verified, + legacy `data-et-prop-inventory_status` fallback), Mercari (status enum). **Not** StockX (`:334`) or Vinted (`:541`) — both hardcode `False`. |
| **Search grid** (what sold comps needs) | `search_page_extractors.py` | **ThredUp only** among enabled platforms (JSON-LD `offers.availability`). RealReal parses it too but the platform is disabled (PerimeterX). Grailed, Mercari, Depop, Vestiaire, Vinted, Poshmark, StockX **all hardcode `"isSold": False`**. |

Detail-layer answers *"is this one listing I track now gone?"*. Sold comps needs
*"give me N sold listings matching this query"* — a sold-filtered search URL plus a
grid that reads sold state off cards. Only ThredUp does the latter, and even it
cannot filter to sold; it just labels cards correctly.

**Two consequences:**

- **Add ThredUp to the probe.** Its grid already parses real availability, so it may
  be the cheapest platform of all. Caveat: ThredUp is source-only, deliberately
  absent from the fee calculator, and its inventory is women's mass-market — cheap
  data that may not be the data resellers want. Probe it, decide after.
- **`watchlist` is a second sold-data source already owned.** It carries
  `created_at`, `price_at_add`, `price_current`, `is_sold`, `last_checked_at`. Every
  tracked item that flips to sold is a real sold price *with an observed duration*,
  making **days-to-sell derivable even if no platform exposes a sale date**. Long-game
  asset, not v1: 10 rows today. Do not scope it into this build; do keep the flip
  timestamp in the schema.

**Deferred, with reasons (do not silently re-add):**

- **eBay.** Richest sold data anywhere, most expensive to get. Only platform with no
  native extractor (Avenue B, Firecrawl-only, ~1 in 5 Akamai 403s). `LH_Sold=1&LH_Complete=1`
  is real but the most heavily guarded URL on the site. The eBay **Browse API does
  not expose sold data**; Marketplace Insights does but is restricted-access and needs
  an application. Revisit only if the three-platform version proves demand.
- **StockX.** One lowest-ask per SKU means its price is already effectively a comp,
  and it is sneakers-only. Low incremental value.

**An honest consequence of this scope:** the three in-scope platforms skew women's
resale (Poshmark), general goods (Mercari) and menswear/streetwear (Grailed). A
coherent slice, but not "every marketplace" — the Step 4 copy must not overstate it.

**Tasks:**

1. **Probe first, no code.** Throwaway script: fetch each search URL (Poshmark,
   Mercari, Grailed, **plus ThredUp**) with a candidate sold filter, dump HTML.
   Confirm per platform (a) the filter param exists, (b) the sold grid reuses the
   card selectors the existing extractor targets, and (c) **whether a sale date is in
   the DOM**. (c) gates days-to-sell — if no platform exposes it, ship median sold
   price + sell-through only and say so, rather than promising a number you cannot
   compute. Nothing here gets assumed (CLAUDE.md rule 1).
2. **Extend the sidecar path, do not fork it.** Add `sold: bool` to
   `ScrapeSearchRequest`, thread into `search_url_for(platform, query, sold=False)`.
   Extractors mostly unchanged — they already emit `isSold`. Cache key becomes
   `platform::query::sold` so sold and live results cannot collide in `_search_cache`.
3. **New aggregate endpoint, separate from search.** `POST /sold-comps {query, platforms}`
   → `{medianSold, n, sellThroughPct, daysToSell|null, perPlatform[]}`. Sell-through is
   computable without a sale date: sold count over (sold + live) count for the same query.
4. **Wire into the margin calc.** `netFlipProfit()` (`lib/marketplaceFees.ts:201`) takes
   `resalePrice` as a plain number, so it does not change. The change is in
   `PriceSummary.tsx` — `FlipMargin` currently defaults `resale` to
   `averagePrice ?? priceRange.max`, i.e. average *asking* price. Default it to median
   sold; keep average-ask as the secondary one-tap option.
5. **Log the result in §6c** before deciding anything about eBay. The point of the
   three-platform scope is to learn cheaply whether sold comps changes behaviour at
   all. If it does not, eBay would not have saved it.

Tasks 2-4 touch the sidecar and the streaming search path: use
`/superpowers:brainstorming` → spec → plan → worktree → subagent execution. Task 1 is
a scratchpad script.

### Step 2 — Alerts as the front door

**Already shipped 2026-08-10 — do not redo.** Results-page alert CTA is now a
primary full-width card (`app/components/AlertCtaBanner.tsx`) with two states,
watching and not-watching; creating an alert navigates to `/alerts?new=1&query=…&platforms=…`
which opens the form pre-filled behind the normal quota gate; the first alert run
sends a baseline email showing what matches right now; compound criteria are exposed
end-to-end (min + max price input, live AND-chain readout, chips on the alert card).
A repeat-search trigger was built and reverted the same day — two states are enough.
Measured as EXP-002 and EXP-003 in §6c.

**Still open:**

**(a) Onboarding flow for new signups — DEFERRED, not built.** Both signup paths
(password with email confirmation, and Google OAuth) route through
`auth/callback/route.ts` and fall through to its default `next = '/search'`
(`:8`), because neither passes a `next` param. A new user lands on a blank search box
with alerts nowhere in sight. When picked up: pass `next=/onboarding` from both
signup entry points (`emailRedirectTo` in the `signUp()` call at `login/page.tsx:72`,
`redirectTo` in `signInWithOAuth()` at `:106`). **Verify, do not assume, that
Supabase's OAuth redirect preserves an appended query param through the full round
trip.** The `/onboarding` page offers "Search" or "Set up an alert" as equal first
choices with an easy skip link.

> **Do not touch** the sign-in redirect (`login/page.tsx:69`) or the has-session
> redirect (`:31`). Both are a separate code path, and onboarding must show for new
> signups only, never for returning users.

**(b) Public alert creation, no account — DEFERRED, gated on (a) and EXP-002 both
showing alerts convert.** A landing-page form (query, platforms, email) where the
confirmation email *is* the signup. The economic logic holds: an alert costs almost
nothing (`withListingsCache` fans one scrape to N watchers) while a free search is
the real COGS, so today the expensive thing is given away and the cheap one is gated.
But a public front door to something people will not adopt even when offered directly
is a door to nothing.

> **Abuse note.** Existing protections do **not** cover this.
> `FREE_BASELINE_EDIT_COOLDOWN_HOURS` is a per-alert *edit* cooldown and
> `max_saved_searches` is a per-user cap (`app/api/saved-searches/route.ts:102`);
> both key off an authenticated `user_id`, which a public endpoint does not have.
> Needs Turnstile, an IP/email rate limit, and no scrape until the email is confirmed.

### Step 3 — Stop writing blog posts · standing instruction

116 posts producing 39 clicks in 90 days, with compare pages at zero clicks from 696
impressions at position 9, is a settled experiment. The AI Overview owns these SERPs
and the July rewrite did not dislodge it.

- **Do not** add posts 117 onward on the current pattern.
- **Do** keep the 33 compare pages fresh — one cron run, and the only genuinely
  citable asset. Treat them as an AI-answer-engine surface, not a click source, and
  stop measuring them on clicks.
- Redirect the writing effort into Step 0 and Step 4. Distribution to resellers is a
  community problem (r/Flipping, Discord servers, YouTube reseller channels), not a
  keyword problem.

### Step 4 — Rewrite positioning · BLOCKED on Step 1

**Sequencing is the whole point.** The 2026-06-29 reseller-only framing was copy on
top of a buyer-shaped product: the same 9-platform live-asking-price search,
relabeled. It did not convert, and re-running it tomorrow would fail identically,
because live asking prices do not answer a reseller's question. **Sold comps is what
makes the narrow claim true. Ship it first, then narrow.**

Note what the 2026-07-11 walk-back to hybrid B2B+B2C actually rested on: GSC showed
no ranking equity tied to the reseller-first title. But there is no equity in *either*
framing — the domain has 39 clicks in 90 days. "No equity in the reseller title" and
"no equity, period" are indistinguishable in that data, so the walk-back was made on
a null result rather than on evidence that the broader framing works.

Once sold comps ships, update in this order:
`B2B_FEATURE_TRUTH.md` §5 → `app/layout.tsx` metadata → `Hero.tsx` → `faqData.ts` →
`PricingCards`. Two claims to lead with:

1. **"Sold prices across the marketplaces the extensions don't cover."** Grailed,
   Vinted, StockX, Vestiaire are the differentiators. Say them by name. Scope the
   claim to whatever Step 1 actually shipped, not to all 9.
2. **"We're paid by you, not by the marketplaces."** Every competitor in Segment A
   takes affiliate commission on where they send you; one was just suspended from
   Impact.com for taking credit it did not earn. Crawli has no incentive to rank one
   marketplace over another, and that is checkable.

### What to deliberately NOT do

- **Do not build a browser extension.** Head-on fight with Beni, on their surface,
  with 1/50th the coverage and none of the capital.
- **Do not build visual search.** Beni Lens shipped Dec 2025 on Vertex AI with
  patent-pending claims; Gem's image search already works well per third-party
  comparison. A two-year-behind race.
- **Do not chase platform count for its own sake.** 9 well-parsed platforms with
  sold data beats 20 with asking prices.
- **Do not add an affiliate revenue stream.** The one thing that would forfeit the
  trust position, and the unit economics are publicly bad.

---

## 6. Value-proposition ledger + experiment log

**This is the live section.** Its job is to stop the project from marketing a claim
it has not earned, which is exactly what happened with the 2026-06-29 reseller-only
copy.

### 6a. Baseline — frozen 2026-08-07, before any change

Do not re-baseline; add a new row instead, so drift stays visible.

| Metric | Baseline | Source |
|---|---|---|
| Total users | 36 (1 paid, max tier) | `auth.users`, `profiles` |
| Searches per user per month | **1.9** (26 searches / 14 users / 30d) | `search_history` |
| Free-tier cap utilisation | ~9% (1.9 of ~20/mo) | vs `TIER_CAPS.free` |
| Activation (ever searched) | 26 / 36 = 72% | `search_history` |
| **Searched exactly once, ever** | **10 / 26 = 38%** | `search_history` |
| **Returned on a 2nd distinct day** | **7 / 26 = 27%** | `search_history` |
| Users with ≥1 save | 4 | `saves` |
| Users with ≥1 alert | **2** | `saved_searches` |
| GSC (90d) | 8,203 impr · 39 clicks · 0.48% CTR | GSC |
| Compare pages (30d) | 696 impr · **0 clicks** · pos ~9 | GSC |

**The two numbers that matter most: 38% one-and-done, and 27% second-day return.**
If a change does not move those, it did not work, regardless of how the funnel looks.

### 6b. Claim ledger — what we may and may not say

**Marketing copy may only use a claim at Validated.** Anything else is for testing,
not for the landing page, the metadata, or a carousel.

| # | Claim | Status | Evidence / what would validate it |
|---|---|---|---|
| C1 | "Sold prices across Poshmark, Mercari and Grailed in one place" | **Hypothesis** | Not built (Step 1). Validates if sold-comps users show higher 2nd-day return than baseline 27%. |
| C2 | "We're paid by you, not by the marketplaces we rank" | **True but untested** | Factually correct today (subscription, zero affiliate code). Untested as a *motivator*. Validates if it measurably lifts signup or is volunteered by users unprompted. |
| C3 | "Alerts with compound criteria: your search terms AND size AND a price range" | **True, unadopted** | `applyCriteria()` ships, and as of 2026-08-10 the UI exposes all of it. **It is `size` + `minPrice` + `maxPrice` only — brand and keywords live in the query string. Never write copy implying four independent criteria fields.** Still 2 users. Validates on EXP-002 / EXP-003. |
| C4 | "Covers marketplaces the extensions don't" (Grailed, Vinted, Vestiaire, Depop) | **True, unvalidated as a reason to switch** | Coverage is real vs Beni's partner list. Nobody has said it made them choose Crawli. |
| C5 | "Know your real margin before you buy" | **Partially true** | `netFlipProfit()` fees are verified, but resale price defaults to average *ask*. Fully true only after Step 1 task 4. |
| C6 | "Best price on a secondhand item" (current landing framing) | **Falsified as a wedge** | Gem and Beni do this better and free (§3). Do not lead with it. |

### 6c. Experiment log

One block per experiment. **Write the hypothesis and the kill criterion before
shipping, not after reading the result.** With ~36 users nothing here will be
statistically significant — these are directional reads, and small-n honesty is part
of the record.

#### Running

```
### EXP-002 — alert CTA prominence + compound criteria surfacing
Started:            2026-08-10 (open)
Claim under test:   C3
Hypothesis:         If the alert CTA is the primary control on the results page rather
                    than a tertiary one, and the AND-chain is legible both while
                    building an alert and after creating it, then the share of the 24
                    users who have searched but never alerted moves from 0/24.
Shipped:            AlertCtaBanner.tsx (new, 2 states) · SearchSection.tsx (banner
                    replaces the ghost "Save as alert" button; hasAlert read from the
                    existing GET /api/saved-searches; CTA navigates to
                    /alerts?new=1&query=…&platforms=…) · alerts/page.tsx +
                    AlertsTabsClient + SearchAlertsTab (autoCreate → quota-gated,
                    pre-filled modal) · CreateAlertModal (minPrice input, bordered
                    criteria block, AND-chain readout, min>max guard) ·
                    SavedSearchCard (criteria chips) · SearchAlertsTab (copy) ·
                    AlertsAndTrackedSection (dead "+ New alert" → /login?tab=signup;
                    not part of the experiment, listed so the diff is complete)
Primary metric:     Share of the pre-existing 24 (searched, never alerted) who create
                    ≥1 alert. Baseline 0/24 for that cohort.
Kill criterion:     If making the alert CTA primary does not convert a meaningful
                    share of that specific 24, alerts are not as compelling as this
                    doc assumes, and the "alerts as the front door" thesis (including
                    EXP-005) needs re-examination rather than another iteration.
n:                  24 (pre-existing cohort), plus new signups incidentally
Result:             pending
Read:               pending
Ledger update:      pending
Caveats set in advance:
  (a) CTA prominence and criteria surfacing shipped together and both act before
      alert creation. They are NOT separable — do not attribute a split.
  (b) A repeat-search trigger was cut before ship, so this tests prominence, not
      prominence plus an intent-timed nudge. A null result therefore falsifies less
      than the original design would have: it rules out "prominence alone was the
      blocker", not "people don't want alerts". If it comes back null, the honest
      next question is whether an intent trigger would have changed it.
```

```
### EXP-003 — immediate baseline email on first alert run
Started:            2026-08-10 (open)
Claim under test:   C3
Hypothesis:         If creating an alert immediately produces an email showing what
                    matches right now, rather than silence until something new
                    appears, then 2nd-day return moves from the 27% baseline.
Shipped:            lib/email/alertEmailTemplate.ts (buildBaselineEmailHtml + a shared
                    emailShell the existing new-matches email was refactored onto;
                    its rendered content is unchanged) · lib/alertRunner.ts
                    (sendBaselineEmail on the isFirstRun branch) · copy corrected in
                    CreateAlertModal + SearchAlertsTab, which previously promised
                    "no email then"
Primary metric:     2nd-day return, baseline 27% (6a)
Kill criterion:     If alert creators' 2nd-day return does not beat the 27% all-user
                    baseline, the activation-email theory is wrong and the next lever
                    is the alert's content, not its timing.
n:                  every alert created or baseline-edited from 2026-08-10
Result:             pending
Read:               pending
Ledger update:      pending
Note:               Readable independently of EXP-002 — it acts only after an alert
                    exists, whatever caused the user to create one.
```

#### Queued

- **EXP-001 — onboarding flow for new signups.** Not built (Step 2a). Claim C3.
  Primary metric: **share of new signups, from ship date forward, who create ≥1 alert
  in their first session.** No like-for-like baseline exists — this experiment
  establishes the number. The all-time 2/36 = 6% figure is context only, not a
  matched baseline. **Kill criterion: if fewer than ~15-20% of new signups create an
  alert even when it is offered as an equal first choice next to search, that is
  evidence against the thesis — read together with EXP-002, not alone.** Nothing
  shipped so far touches the signup path, so this stays cleanly separable from
  EXP-002 whenever it is built.
- **EXP-004 — sold comps in the margin panel.** Step 1 task 4. Claims C1 + C5.
  Primary metric: searches per user per month, baseline 1.9.
- **EXP-005 — public alert creation.** Step 2b. Claim C3. **Gated on EXP-001 and
  EXP-002 both showing alerts convert** — it does not unblock just because EXP-002
  shipped first. Primary metric: signups, baseline ~0.57-1/day.

### 6d. How marketing follows from this

**No channel work starts until a claim reaches Validated.** The reason the current
TikTok/blog motion has produced 39 clicks in 90 days is that channel came before
claim.

1. **Claim validated in 6b** → then and only then it goes in copy.
2. **Copy updated in the Step 4 order.** `B2B_FEATURE_TRUTH.md` stays the source of
   truth for what is claimable — update it first, always.
3. **Channel chosen to match the validated claim**, not the reverse. If C1 validates,
   the audience is resellers and the channels are r/Flipping, reseller Discords and
   YouTube reseller channels — not SEO, which Step 3 established is capped by AI
   Overviews on these queries.
4. **The obfuscate-commercial-intent rule in CLAUDE.md was written for the old B2C
   carousel motion.** If the position narrows to resellers, revisit it: that rule
   produced 0 comments across 55 posts (GROWTH_PLAN §1), so it has already failed its
   own stated KPI once.

---

## 7. Sources

- Beni funding, coverage, model: [Retail Dive](https://www.retaildive.com/news/resale-tech-startup-beni-raises-4m/638726) · [PR Newswire](https://www.prnewswire.com/news-releases/beni-raises-over-5m-to-make-secondhand-shopping-easier-than-ever-301700851.html) · [Google Developers Blog](https://developers.googleblog.com/how-recommerce-startup-beni-uses-ai-to-help-you-shop-secondhand/) · [Google for Startups](https://startup.google.com/alumni/stories/beni/)
- Beni Lens: [PR Newswire, 2025-12-10](https://www.prnewswire.com/news-releases/beni-unveils-beni-lens-the-first-visual-search-engine-for-secondhand-fashion--making-thrifting-as-easy-as-shopping-new-302637397.html)
- Gem coverage and features: [Forbes](https://www.forbes.com/sites/sharonedelson/2025/01/20/online-vintage-and-secondhand-search-engine-gem-adds-new-features/) · [gem.app/about](https://gem.app/about)
- Beni vs Gem head-to-head: [All Things Fashion Tech](https://allthingsfashiontech.substack.com/p/over-phias-cookiegate-beni-vs-gem)
- Phia cookie-stuffing: [TechCrunch, 2026-07-10](https://techcrunch.com/2026/07/10/phia-accused-of-cookie-stuffing-taking-affiliate-credit-on-purchases-it-didnt-earn/) · [Inc.](https://www.inc.com/esther-lian/phoebe-gates-startup-phia-accused-cookie-stuffing-what-happens-next/91372500)
