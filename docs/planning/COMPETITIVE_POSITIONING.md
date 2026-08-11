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
| **Step 0 — audience validation** | **skipped 2026-08-10, owner decision.** See the note under Step 1. |
| **Step 1 — sold comps (Grailed + Poshmark)** | **shipped 2026-08-10** · EXP-004 running. Mercari and ThredUp dropped on probe evidence. |
| Step 2 — alert CTA prominence | shipped 2026-08-10 · EXP-002 running |
| Step 2 — compound criteria surfaced | shipped 2026-08-10 · folded into EXP-002 |
| Step 2 — baseline email on first alert run | shipped 2026-08-10 · EXP-003 running |
| **Step 2 — onboarding flow for new signups** | **deferred 2026-08-10, not built** · EXP-001 |
| **Step 2 — public alert creation** | **deferred + gated** on EXP-001 and EXP-002 · EXP-005 |
| Step 3 — stop writing blog posts | standing instruction |
| **Step 4 — rewrite positioning** | **unblocked 2026-08-10** — Step 1 shipped. Gated on C1 reaching Validated. |

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

### Step 0 — Settle the audience question · SKIPPED 2026-08-10

**Owner decision: skipped, and Step 1 was built without it.** The consequence is
recorded here rather than lost: a null EXP-004 result is now **ambiguous**. It cannot
separate "sold comps does not change behaviour" from "these 36 users were never
resellers." EXP-004's own kill criterion therefore has to carry the weight this step
was meant to carry, and it was written before shipping (§6c).

If EXP-004 comes back null, run this step before iterating on the feature — the
alternative is a second month spent on a question a few emails would have answered.

The original plan, kept for whenever it is picked up:

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

### Step 1 — Ship sold comps · SHIPPED 2026-08-10

The one feature that changes what Crawli is. Built and live. Design spec:
`docs/superpowers/specs/2026-08-10-sold-comps-design.md`. Measured as EXP-004.

**Shipped scope: Grailed + Poshmark.** Mercari was dropped during the probe and
ThredUp was ruled out by it. eBay and StockX remain deferred as previously decided.

**The probe overturned the plan this section used to contain.** That plan assumed
sold comps meant adding a `sold` flag to the Python grid extractors and threading it
through `/scrape-search`. That is the wrong layer for both shipped platforms. All
findings below were verified live on 2026-08-10, not inferred.

| Platform | Sold filter | Transport | Sale price | Sale date | Days-to-sell | Outcome |
|---|---|---|---|---|---|---|
| **Grailed** | Algolia index `Listing_sold_production` | plain HTTPS POST | `sold_price`, the true final | `sold_at` exact | yes | **shipped** |
| **Poshmark** | `availability=sold_out` + `sort_by=recently_sold` | plain HTTP GET | `price_amount`, the ask at time of sale | `inventory.status_changed_at` | yes | **shipped** |
| Mercari | `itemStatuses=2` | browser render (raw-403s) | first `$` on the card | **none in the DOM** | no | **dropped** — cost + no date |
| ThredUp | none; `availability=sold` is ignored | — | — | — | — | **ruled out** |

**Because both shipped platforms are plain HTTP, the Python sidecar was not touched
at all.** No `sold` flag on `ScrapeSearchRequest`, no cache-key change, no new
`wait_for`. The feature is entirely TypeScript in `lib/soldComps/`. A sold-comps
lookup is two HTTP requests and roughly a second, against ~35s/platform for live
search — the cost assumption in the old plan was backwards.

**ThredUp is a direct correction.** This doc previously said "add ThredUp to the
probe — its grid already parses real availability, so it may be the cheapest platform
of all." Probed: `availability=sold` is ignored, returning 119 items of which 114
were in stock and 5 incidentally sold. There is no sold filter. Do not re-probe
without new evidence.

**Deferred, unchanged:** eBay (richest sold data, most expensive to get; Browse API
does not expose sold data, Marketplace Insights is restricted-access) and StockX
(one lowest-ask per SKU is already effectively a comp, and it is sneakers-only).

**`watchlist` remains a second sold-data source already owned** — `created_at`,
`price_at_add`, `is_sold`, `last_checked_at` make days-to-sell derivable from our own
observations. Still ~10 rows. Long game, deliberately not in this build.

#### What shipped

1. **`lib/soldComps/`** — `grailed.ts` (Algolia + key management), `poshmark.ts`
   (`window.__INITIAL_STATE__` parse), `aggregate.ts` (relevance, trim, windowing),
   `index.ts`, `types.ts`.
2. **`POST /api/sold-comps`** — auth-gated, 24h cache in the new `sold_comps_cache`
   table, **does not consume a search credit**. Separate from `/api/search`, whose
   streaming NDJSON path was not touched.
3. **Margin calculator now defaults to sold price.** `FlipMargin` in
   `PriceSummary.tsx` previously defaulted resale to `averagePrice ?? priceRange.max`
   — average *asking* price. It now seeds from the median of completed sales, with
   `avg ask` and `high` kept as one-tap alternatives. This is what makes C5 true.
4. **`SoldCompsPanel.tsx`** — one row per marketplace, each with its own median,
   p25-p75, sample size, window, and days-to-sell.
5. **`scripts/verify-sold-comps.mts`** — 33 checks, unit plus live. Run with
   `npx tsx scripts/verify-sold-comps.mts`.

#### Three findings that constrain what copy may claim

1. **There is deliberately no pooled cross-platform median.** For "nike air jordan 1"
   Grailed's sold inventory is adult pairs (median $125) while Poshmark's is mostly
   youth sizes and Mid/Low models (median $33). A pooled figure ($55) describes
   neither market. **Report per platform or not at all.** The margin calculator seeds
   from Grailed when it qualifies, Poshmark otherwise, and the user can switch.
2. **Poshmark's price is the ask at the moment of sale, not the accepted offer.**
   Poshmark hides accepted offers. Never write "what it actually sold for" about
   Poshmark. Grailed's `sold_price` *is* the true final.
3. **No sell-through metric shipped.** Poshmark's total is all-time-sold and caps at
   5000; Grailed's is a true 90-day window. The denominators are not comparable and
   one blended number would mislead.

#### Data-quality rules baked in

- **Window widening:** 90d, else 180d, else 365d. Every figure is displayed with the
  window that produced it.
- **Sample floor:** n ≥ 10 after filtering, or the platform is omitted. If neither
  qualifies the panel does not render. Verified against a nonsense query.
- **Relevance filtering** reuses `titleMatchesQuery` from `lib/parse.ts` (exported for
  this). Required: Poshmark sold sorted by price returns a $1,375 median for "nike air
  jordan 1" — bundles and wrong items. Same class of problem as `filterAuthentic()`.
- **IQR outlier trim**, with the spread floored at 10% of the median so a degenerate
  zero-IQR sample still fences out a 50x bundle listing.
### Step 2 — Alerts as the front door

**Already shipped 2026-08-10 — do not redo.** Results-page alert CTA is now a
primary full-width card (`app/components/AlertCtaBanner.tsx`) with two states,
watching and not-watching; creating an alert navigates to `/alerts?new=1&query=…&platforms=…`
which opens the form pre-filled behind the normal quota gate; the first alert run
sends a baseline email showing what matches right now; compound criteria are exposed
end-to-end (min + max price input, live AND-chain readout, chips on the alert card).
A repeat-search trigger was built and reverted the same day — two states are enough.
Measured as EXP-003 in §6c. (EXP-002 covered the CTA-prominence half and was superseded
2026-08-10 with zero exposure — the *code* stays live, only the experiment retired.)

**Still open:**

**(a) Onboarding flow — DESIGNED 2026-08-10, not yet built.** Spec:
`docs/superpowers/specs/2026-08-10-onboarding-flow-design.md`. Measured as EXP-001.

**The evidence that shaped it.** Every searcher bucketed by first-24-hour activity:

| Searches on day 1 | Users | Ever returned |
|---|---|---|
| 5+ | 3 | **100%** (3/3) |
| 4 | 5 | 60% (3/5) |
| 2-3 | 10 | 10% (1/10) |
| 1 | 10 | **0%** (0/10) |

Monotonic, cliff between 3 and 4. **This overturns the assumption that users churn
because they exhaust the free cap.** Only 3 of 28 ever reached 5 in a week; the other
25 quit before reaching it. They are not hitting a wall, they are leaving before they
find one. First-session depth is the constraint, not the cap — which is further
evidence for §1 finding 1 and against any pricing-side fix. Small n, correlational,
and the top cohort includes the single paid user; caveats are recorded in the spec.

**Design, in brief.** Branch on question 1 ("buying for yourself, or to resell?" — this
is Step 0's survey question, finally collected). Shared spine for both branches: seed
query → criteria (size + min/max price) → alert created, which fires the EXP-003
baseline email. Reseller tail adds sold comps then margin-after-fees. Buyer tail adds
one optional screen — *"got anything sitting in your closet?"* — which is the cheapest
available on-ramp from buyer to reseller and attacks the §4 audience tension directly.
Ends by handing off to `/search` with the query pre-filled.

**Three properties worth carrying forward:**

- **It costs zero searches.** `/api/sold-comps` does not charge a credit, alert creation
  does not charge a credit, and the flow does not run a live search — it hands off. No
  refund mechanism, no abuse surface, and **`/api/search` is not touched.**
- **It is gated on `profiles.onboarding_completed_at IS NULL` in
  `(protected)/layout.tsx`**, not on a redirect param. Consequences: existing accounts
  are onboarded too (owner requirement), and **the OAuth query-param assumption this
  section used to carry is deleted rather than tested.** `login/page.tsx` and
  `auth/callback/route.ts` are not modified at all, so the warning below is satisfied
  by construction.
- **It is blocking** (owner decision): no skip, no exit until complete, all users
  including the existing 39. `/onboarding` therefore lives outside `(protected)/` so it
  cannot be caught by its own gate, and every step must advance even when its upstream
  call fails — a blocking flow with a failing step is a locked account.

> **Do not touch** the sign-in redirect (`login/page.tsx:69`) or the has-session
> redirect (`:31`). The flag-driven gate makes this moot, but the constraint stands if
> anyone revisits the redirect approach.

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

#### Drift row — 2026-08-10 (added, not a re-baseline)

| Metric | 2026-08-07 | 2026-08-10 |
|---|---|---|
| Total users | 36 | **39** |
| Signups /30d | 17 | **20** (~0.67/day) |
| Searchers | 26 | **28** |
| Users with ≥1 alert | 2 | **3** (5 alerts total) |

Growth is happening with no additional promotion — posting has not restarted.

**New measure, first captured 2026-08-10: first-session depth.** Share of searchers who
ever returned, by first-24-hour search count — 1 search: **0%** (0/10) · 2-3: 10% (1/10) ·
4: 60% (3/5) · 5+: **100%** (3/3). 21 of 28 searchers (75%) were active on exactly one
day, ever. See §5 Step 2(a).

> **Counting rule, do not get this wrong.** A `search_history` row is a distinct
> `(user_id, query, platforms, filters)` combination — the table has a UNIQUE
> `search_history_dedupe` index, so repeats upsert. It is **not** an attempt count
> (true repeats were never recorded and are unrecoverable) and **not** a charge count
> (`app/api/search/route.ts:223-252` charges only when a search returns ≥1 listing, and
> cache hits early-return before that block). 9 rows against a cap of 5 is normal.
> The dedupe biases the depth gradient *conservatively*: a returner re-running an old
> query moves that row's `searched_at` forward, out of their day-1 bucket.

### 6b. Claim ledger — what we may and may not say

**Marketing copy may only use a claim at Validated.** Anything else is for testing,
not for the landing page, the metadata, or a carousel.

| # | Claim | Status | Evidence / what would validate it |
|---|---|---|---|
| C1 | "Sold prices from Grailed and Poshmark in one place" | **Built, unvalidated** | Shipped 2026-08-10. **Mercari is NOT in it — do not name Mercari in copy.** Validates if sold-comps users show higher 2nd-day return than baseline 27% (EXP-004). Two hard limits on wording: never imply a single blended cross-platform price (there isn't one, and §5 explains why), and never say "what it actually sold for" about Poshmark (accepted offers are hidden — that phrasing is only true of Grailed). |
| C2 | "We're paid by you, not by the marketplaces we rank" | **True but untested** | Factually correct today (subscription, zero affiliate code). Untested as a *motivator*. Validates if it measurably lifts signup or is volunteered by users unprompted. |
| C3 | "Alerts with compound criteria: your search terms AND size AND a price range" | **True, unadopted** | `applyCriteria()` ships, and as of 2026-08-10 the UI exposes all of it. **It is `size` + `minPrice` + `maxPrice` only — brand and keywords live in the query string. Never write copy implying four independent criteria fields.** Still 2 users. Validates on EXP-002 / EXP-003. |
| C4 | "Covers marketplaces the extensions don't" (Grailed, Vinted, Vestiaire, Depop) | **True, unvalidated as a reason to switch** | Coverage is real vs Beni's partner list. Nobody has said it made them choose Crawli. |
| C5 | "Know your real margin before you buy" | **True as of 2026-08-10** | `netFlipProfit()` fees were already verified; the remaining gap was that resale defaulted to average *ask*. It now defaults to the median of completed sales (`FlipMargin`, seeded from Grailed when it qualifies). Still unvalidated as a *motivator* — true is not the same as persuasive. |
| C6 | "Best price on a secondhand item" (current landing framing) | **Falsified as a wedge** | Gem and Beni do this better and free (§3). Do not lead with it. |

### 6c. Experiment log

One block per experiment. **Write the hypothesis and the kill criterion before
shipping, not after reading the result.** With ~36 users nothing here will be
statistically significant — these are directional reads, and small-n honesty is part
of the record.

#### Running

```
### EXP-002 — alert CTA prominence + compound criteria surfacing  [SUPERSEDED]
Started:            2026-08-10 · Superseded 2026-08-10 (see Disposition)
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
n:                  0 exposed. AlertCtaBanner renders only on a results page, and none
                    of the 24 ran a search in the ~29h between ship and 2026-08-11.
Result:             SUPERSEDED 2026-08-10 — never independently readable.
Read:               No observation, weak or otherwise. Owner note: no traffic because
                    posting has not restarted. **Do NOT record this as 0/24** — that
                    would fire the kill criterion below on zero evidence and could talk
                    the project out of the alerts thesis for no reason.
Disposition:        Measurement folded into EXP-001, which ships to the same cohort
                    (onboarding is blocking and applies to existing accounts too, so
                    the two can no longer be separated). The shipped changes stay live;
                    only the experiment is retired.
Ledger update:      None. C3 stays "True, unadopted".
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
### EXP-004 — sold comps on the results page
Started:            2026-08-10 (open)
Claim under test:   C1 + C5
Hypothesis:         If a search returns what the item actually sold for and how long
                    it took, rather than only what sellers are asking, then searching
                    becomes worth repeating and searches per user per month moves off
                    the 1.9 baseline.
Shipped:            lib/soldComps/ (grailed.ts Algolia + key refresh · poshmark.ts
                    __INITIAL_STATE__ parse · aggregate.ts relevance/trim/windowing ·
                    index.ts · types.ts) · POST /api/sold-comps (auth-gated, 24h
                    sold_comps_cache, no search credit charged) · SoldCompsPanel.tsx ·
                    PriceSummary.tsx (FlipMargin resale now seeds from median sold
                    instead of average ask; "sold" / "avg ask" / "high" chips) ·
                    ResultsDisplay passes data.query · relevanceTokens +
                    titleMatchesQuery exported from lib/parse.ts ·
                    scripts/verify-sold-comps.mts (33 checks)
Primary metric:     Searches per user per month, baseline 1.9 (6a)
Secondary:          2nd-day return, baseline 27% (6a)
Kill criterion:     If searches per user per month does not move off 1.9 within 30
                    days of ship, sold comps did not change what the product is worth
                    to the current users. Because Step 0 was skipped, that result is
                    AMBIGUOUS by construction — it cannot distinguish "sold comps
                    doesn't matter" from "these users were never resellers".
                    Do NOT iterate on the feature on a null result. Run Step 0 first
                    and only then decide whether to extend (eBay), or to stop.
n:                  every search from 2026-08-10 forward
Result:             pending
Read:               pending
Ledger update:      pending
Caveats set in advance:
  (a) The panel only renders when a platform clears n>=10 within 365 days, so
      thin-catalogue queries see nothing. A null result must be read against how
      often the panel actually rendered, not against total searches. Instrument
      that before concluding anything.
  (b) Grailed and Poshmark are reported separately and can differ by 3-4x on the
      same query (real inventory difference, not error). If users find that
      confusing rather than informative, that is a UX finding, not a data finding.
  (c) Depends on an undocumented Grailed Algolia index and a Poshmark state blob.
      Silent upstream breakage would look identical to "nobody engaged" in the
      metric. Check scripts/verify-sold-comps.mts passes before reading the result.
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

- **EXP-001 — onboarding flow.** Designed 2026-08-10, not yet built (Step 2a). Claim C3.
  Spec: `docs/superpowers/specs/2026-08-10-onboarding-flow-design.md`.
  - **Primary metric:** share of users completing onboarding who create ≥1 alert.
  - **Secondary:** first-session depth (against the §6a drift-row gradient) and 2nd-day
    return (baseline 27%).
  - **Kill criterion:** below ~15-20% alert creation, when an alert is created *as part
    of the flow itself*, is evidence against the alerts thesis. Note this is a stronger
    test than the original wording — alerts are no longer merely "offered as an equal
    choice", they are the spine of the flow, so a null result here is harder to explain
    away than it would have been.
  - **Scope note:** onboarding is blocking and applies to existing accounts, so EXP-001
    now absorbs the population EXP-002 was meant to measure. It is no longer separable
    from EXP-002 and does not need to be — see that block's Disposition.
  - **Read it against the panel-render caveat**, same as EXP-004: the reseller tail
    renders nothing below the n ≥ 10 sold-comps floor. Instrument how often it rendered
    before concluding anything about the tail.
- ~~EXP-004 — sold comps in the margin panel.~~ **Shipped 2026-08-10 — moved to
  Running above.**
- **EXP-005 — public alert creation.** Step 2b. Claim C3. **Gated on EXP-001 alone**
  (revised 2026-08-10: EXP-002 was superseded before it produced a reading, so it can no
  longer be part of the gate). Primary metric: signups, baseline ~0.67/day as of the
  §6a drift row.

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
