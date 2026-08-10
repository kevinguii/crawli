# Crawli — Competitive Positioning vs the Recommerce Aggregator Landscape

**Created:** 2026-08-07 · **Owner:** Kevin · **Status:** decision doc

Companion to `docs/planning/GROWTH_PLAN.md`. GROWTH_PLAN answers "how do we get
distribution." This doc answers the prior question: **is the category Crawli is
currently in winnable, and if not, which adjacent one is.**

All Crawli numbers pulled live 2026-08-07 (Supabase `peyqxfijdrziqfjkxjsn` + GSC
`thecrawli.com`). Competitor numbers are cited to public sources.

---

## 1. Where Crawli actually stands (live data, not vibes)

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

### The three findings that matter

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
clicks at position 15.7. The AI-Overview zero-click ceiling diagnosed on 2026-07-17
is real and it did not move after the AIO-citability rewrite. Adding more posts is
currently the lowest-ROI activity available.

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
| **Crawli** | Web app, active search | **9 platforms**, live on-demand scrape, no index | **Subscription** | Boolean alert criteria; verified fee/margin calc; no affiliate exposure |

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

A shopper comparing Crawli to Gem picks Gem in every scenario. That is the honest
read, and no amount of copy fixes it.

### Where Crawli is not actually behind

Three things are genuinely differentiated, and two of them are consequences of
choices that look like weaknesses on the surface:

**1. No affiliate dependency.** Beni's own CEO has publicly named the problem:
affiliate revenue per transaction in resale is low and the model requires enormous
scale. Compounding it, eBay Partner Network runs a 24-hour cookie window, which is
brutal for auction listings. Crawli's subscription model does not care about
attribution windows, does not fight for last-click credit, and cannot be suspended
from Impact.com. Post-Phia, "we never touch your affiliate cookies and we are not
paid by the marketplaces we rank" is a live trust position, not a footnote.

**2. Scraping covers platforms that will not partner.** Beni's partner list skews
P2P and managed consignment (Poshmark, eBay, Depop, ThredUp, RealReal, Vestiaire).
Crawli natively covers **Grailed, Vinted, StockX** — streetwear/EU/sneaker
inventory that is thinner or absent in the feed-partnership world. Narrow, but real.

**3. Boolean alert criteria + shared-scrape economics.** `applyCriteria()` supports
brand AND size AND price AND keyword. Beni batches alerts daily; Gem does real-time
but without compound criteria. And `withListingsCache` fans one scrape out to N
users watching the same query, so alerts have far better unit economics than
one-off search. Alerts are Crawli's structurally cheapest and most defensible
feature, and they are adopted by 2 users.

### The gap that decides this

**Crawli has no sold-comps data.** Search returns live asking prices only. The
codebase detects sold status on an individual listing for watchlist purposes
(`structured_extractors.py` handles Poshmark/Grailed/StockX sold signals) but never
aggregates historical sale prices.

For a buyer, asking price is fine. **For a reseller deciding whether to buy, asking
price is close to worthless** — what matters is what the item actually sold for and
how fast. This is exactly what Underpriced AI sells for $2.99/mo, and it is why
resellers pay for tools at all. Crawli currently charges $10-30/mo for strictly
less decision-relevant data than a $2.99 app.

---

## 4. Recommended position

> **Crawli is the cross-platform sold-price engine for people who buy secondhand to
> resell. Not an affiliate. Not a shopping extension. A paid instrument.**

Why this specific position and not the alternatives:

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
  Grailed, Vinted, StockX, Vestiaire, Depop and ThredUp natively. Streetwear,
  sneakers and EU inventory are where Crawli's existing extractors already win.

**What this means concretely for the site:** the buyer-side price comparison framing
in `B2B_FEATURE_TRUTH.md` §5 gets narrowed, not widened. The 2026-07-11 walk-back to
hybrid B2B+B2C was the wrong direction given what the search logs now show, because
the B2C half is competing with two better-funded, better-covered free products.

### The honest tension, stated plainly

Current users search like buyers, not resellers. Two readings, and they have
different consequences:

- **(a)** The current 36 are the wrong cohort, pulled in by blog content about
  vintage fabric and luxury handbags rather than by anything reseller-shaped. In
  which case the position holds and the audience needs replacing.
- **(b)** There is genuinely no reachable reseller demand for this, in which case
  the honest move is to stop paying for the product and treat it as a portfolio
  piece.

**Do not skip past this.** Step 0 below exists to settle it before any code gets
written, because building sold-comps on reading (b) wastes a month.

---

## 5. Concrete next steps

### Step 0 — Settle the audience question (this week, no code)

The entire plan branches on this. Cost: a few hours.

1. Email all 36 users individually (36 is small enough to do by hand, and hand-written
   converts). One question: *"Are you buying this stuff for yourself, or to resell?"*
   Second question for resellers: *"What do you check before you buy something to flip?"*
2. Post the same question in r/Flipping, r/SneakerDeals, r/Depop, r/poshmark. Not a
   pitch. A question. The `reddit_research` table already has 871 rows of scraped
   sentiment; this is the missing primary-source layer.
3. **Gate:** if fewer than 5 of 36 are resellers *and* the Reddit threads show no
   pull for cross-platform sold comps, stop here and re-open the strategy. Do not
   proceed to Step 1 on optimism.

### Step 1 — Ship sold comps (the product gap)

This is the one feature that changes what Crawli is. Scope it small.

**Scope: Poshmark + Mercari + Grailed ONLY. eBay and StockX are out of scope**
(owner decision, 2026-08-10). Do not add them back without an explicit decision.

Why these three and not the obvious ones:

- **These three are cheap.** Each builds its search URL from a plain query param
  (`poshmark_search_url` → `/search?query=…&type=listings`, `mercari_search_url` →
  `/search/?keyword=…`, `grailed_search_url` → `/shop?query=…`). Sold comps here is a
  URL-param change plus a DOM check.

**Correction (2026-08-10) — what sold detection already exists.** An earlier draft
said sold signals exist for "Poshmark and Grailed." That understated it, and the
two layers behave oppositely:

| Layer | File | Sold detection today |
|---|---|---|
| **Listing detail** (watchlist refresh, one URL at a time) | `structured_extractors.py` | **7 platforms**: Depop, Grailed, ThredUp, eBay, Vestiaire (shared JSON-LD `_availability_is_sold`), Poshmark (JSON-LD, 12/12 verified, + legacy `data-et-prop-inventory_status` fallback), Mercari (status enum). **Not** StockX (`:334`) or Vinted (`:541`) — both hardcode `False`. |
| **Search grid** (what sold comps needs) | `search_page_extractors.py` | **ThredUp only** (JSON-LD `offers.availability`). RealReal too, but disabled. Grailed, Mercari, Depop, Vestiaire, Vinted, Poshmark, StockX **all hardcode `"isSold": False`**. |

The layers answer different questions, which is why broad detail-layer coverage does
not make this feature free. Detail-layer answers *"is this one listing I track now
gone?"*. Sold comps needs *"give me N sold listings matching this query"* — a
sold-filtered search URL plus a grid that reads sold state off cards. Only ThredUp
does the latter, and even it cannot filter to sold; it just labels cards correctly.

Two consequences:

- **Add ThredUp to the probe.** Its grid already parses real availability from JSON-LD,
  so it may be the cheapest platform of all. Caveat: ThredUp is source-only and
  deliberately absent from the fee calculator, and its inventory is women's
  mass-market — cheap data that may not be the data resellers want. Probe it, decide
  after.
- **`watchlist` is a second sold-data source you already own.** It carries
  `created_at`, `price_at_add`, `price_current`, `is_sold`, `last_checked_at`. Every
  tracked item that flips to sold is a real sold price *with an observed duration*,
  which makes **days-to-sell derivable even if no platform exposes a sale date** — the
  clean path around the risk in task 1(c). Long-game asset, not v1: 10 rows today.
  Do not scope it into this build; do make sure the schema keeps the flip timestamp.
- **eBay: deferred, not rejected.** Richest sold data anywhere, and the most expensive
  to get. Only platform with no native extractor (Avenue B, Firecrawl-only, ~1 in 5
  Akamai 403s per Open Issues). `LH_Sold=1&LH_Complete=1` is real but is the most
  heavily guarded URL on the site. The eBay **Browse API does not expose sold data**;
  Marketplace Insights does but is restricted-access and needs an application.
  Revisit only if the three-platform version proves the demand.
- **StockX: deferred.** One lowest-ask per SKU means its price is already effectively
  a comp, and it is sneakers-only. Low incremental value.

An honest consequence of this scope: **the three in-scope platforms skew women's
resale (Poshmark), general goods (Mercari) and menswear/streetwear (Grailed).** That
is a coherent slice, but it is not "every marketplace," and the marketing claim in
Step 4 must not overstate it. See the value-prop ledger in §6.

Tasks:

1. **Probe first, no code.** Throwaway script: fetch each search URL (Poshmark,
   Mercari, Grailed, **plus ThredUp**) with a candidate sold filter, dump HTML. Confirm
   per platform (a) the filter param exists, (b) the sold grid reuses the card
   selectors the existing extractor targets, and (c) **whether a sale date is in the
   DOM**. (c) is the gate on days-to-sell — if no platform exposes it, ship median sold
   price + sell-through only and say so, rather than promising a number you cannot
   compute (`watchlist` is the eventual path to it, see above). Nothing here gets
   assumed (CLAUDE.md rule 1).
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
5. **Log the result in the §6 ledger** before deciding anything about eBay. The whole
   point of the three-platform scope is to learn whether sold comps changes behaviour
   at all, cheaply. If it does not, eBay would not have saved it.

Tasks 2-4 touch the sidecar and the streaming search path: use
`/superpowers:brainstorming` → spec → plan → worktree → subagent execution. Task 1 is
a scratchpad script.

### Step 2 — Make alerts the front door, not search

Alerts are the cheapest feature to run (shared scrape), the stickiest, the one
competitors do worse, and they have 2 users. That ratio is the biggest unforced
error in the product.

**Revised 2026-08-10 (owner challenge, correctly).** An earlier draft argued the
problem was structural — that `app/login/page.tsx:69` pushes new users to `/search`
and `CreateAlertModal` is mounted only behind `(protected)`, so alerts sit downstream
of the expensive gated feature. That reasoning was about *acquiring new users* and it
does not survive contact with the actual population:

> **26 users have searched. 2 have alerts. So 24 people were already inside the app,
> past the auth wall, on a results page, and did not create an alert.**

Those 24 cleared every gate the structural argument blamed. So the auth wall is not
what blocks alert adoption for people who already signed up. **Visibility and trigger
come first; the funnel inversion is a later, separate bet.**

**Settled, 2026-08-10 — landing page dead button.** `AlertsAndTrackedSection.tsx`'s
"+ New alert" button in the alerts/tracked demo is `aria-hidden` and `tabIndex={-1}` —
pure decoration, does nothing on click. Fix: link it to signup. No hypothesis needed
and not logged as an experiment — it currently does nothing, so this is strictly
better regardless of outcome.

Plausible mechanism for the visibility read: the "Save as alert" CTA
(`SearchSection.tsx:126`) is `text-sm`, right-aligned (`justify-end`), colored
`var(--text-muted)` on a plain surface — styled as a tertiary utility control, not as
the thing that makes the product work. That covers people *after* they've searched.
There's an earlier, bigger version of the same gap: **alerts don't exist at all in a
new user's world until after their first search.**

Revised order, framed by moment in the user's journey:

1. **Onboarding flow — the moment signup completes.** Traced through the actual auth
   code, not assumed: password signup requires email confirmation (Turnstile-gated
   `signUp()` at `login/page.tsx:72`, confirmation link routes through
   `auth/callback/route.ts`); Google OAuth (`handleGoogle`, `login/page.tsx:106`)
   routes through the same callback. **Neither passes a `next` param today**, so both
   fall through to the callback's default (`auth/callback/route.ts:8`:
   `next = searchParams.get('next') ?? '/search'`) — a blank search box, alerts
   nowhere in sight. Fix: pass `next=/onboarding` explicitly from both signup entry
   points (`emailRedirectTo` in the `signUp()` call, `redirectTo` in
   `signInWithOAuth()`). **Verify during implementation, don't assume:** that
   Supabase's OAuth redirect actually preserves an appended query param on
   `redirectTo` through the full round trip. New `/onboarding` page offers two equal
   first choices — "Search" or "Set up an alert" — with an easy skip link so it never
   blocks someone who genuinely just wants to search.
   **Do not touch** the sign-in redirect (`login/page.tsx:69`, existing users signing
   back in) or the already-has-a-session redirect (`login/page.tsx:31`) — both are a
   separate code path from the signup/callback path above, and onboarding must only
   show for new signups, never for returning users.
2. **Make the alert CTA primary in the results flow**, not a ghost button above the
   grid, and **trigger on repeat-search intent** — `search_history` shows
   `basketball shorts` searched 6x, `fear of god essentials hoodie` 6x, `light grey
   hoodie` 5x by single users, which is someone manually doing an alert's job by hand.
   Cost: one query against `search_history`. No prompt exists on this today.
3. **First alert run immediate, and email the baseline.** Today the first run sets a
   baseline silently and only later runs email. A "here are the 15 listings matching
   this right now across 6 marketplaces" email is the activation moment, and nothing
   currently plays that role.
4. **Surface the compound criteria.** `applyCriteria()` supports brand AND size AND
   price AND keyword, buried in an optional modal section. Neither Beni nor Gem
   exposes this.
5. **Public alert creation, no account — DEFERRED, gated on (1) and (2) both showing
   alerts convert.** A landing page form (query, platforms, email) where the
   confirmation email *is* the signup. The economic logic still holds: an alert costs
   almost nothing (`withListingsCache` fans one scrape to N watchers) while a free
   search is the real COGS, so today the expensive thing is given away and the cheap
   one is gated. **But it only pays off if alerts are already proven desirable** — a
   public front door to something people won't adopt even when offered directly is a
   door to nothing.
   - **Abuse note for whenever this is revisited:** the existing protections do NOT
     cover it. `FREE_BASELINE_EDIT_COOLDOWN_HOURS` is a per-alert *edit* cooldown and
     `max_saved_searches` is a per-user cap (`route.ts:102`); both key off an
     authenticated `user_id`, which a public endpoint does not have. Needs Turnstile,
     an IP/email rate limit, and no scrape until the email is confirmed.

**Measurement note.** Items 1 and 2 are deliberately clean of each other, and worth
keeping that way when reading results. Onboarding (1) only touches brand-new signups
from ship date forward — it cannot affect anyone who already has an account. CTA
prominence + repeat trigger (2) has its clean test population in the pre-existing 24
who already searched before this ships and never see the onboarding screen (they're
past it). Track both, but don't blend them into one number — they answer the same
underlying question from two different entry points, and disagreement between them is
itself informative.

### Step 3 — Stop writing blog posts

116 posts producing 39 clicks in 90 days, with compare pages at zero clicks from
696 impressions at position 9, is a settled experiment. The AI Overview owns these
SERPs and the July rewrite did not dislodge it.

- **Do not** add posts 117 onward on the current pattern.
- **Do** keep the 33 compare pages fresh — they cost one cron run and are the only
  genuinely citable asset. But treat them as an AI-answer-engine surface, not a
  click source, and stop measuring them on clicks.
- Redirect the writing effort into Step 0 and Step 4. Distribution to resellers is
  a community problem (r/Flipping, Discord servers, YouTube reseller channels), not
  a keyword problem.

### Step 4 — Rewrite positioning after Step 1 ships, not before

**Sequencing matters here and an earlier draft got it wrong** (it said "after Step 0
confirms"). The 2026-06-29 reseller-only framing was copy on top of a buyer-shaped
product: the same 9-platform live-asking-price search, relabeled. It did not convert,
and re-running it tomorrow would fail identically, because live asking prices do not
answer a reseller's question. Sold comps is what makes the narrow claim *true*. Ship
it first, then narrow.

Note also what the 2026-07-11 walk-back actually rested on: GSC showed no ranking
equity tied to the reseller-first title. But there is no equity in *either* framing —
the domain has 39 clicks in 90 days. "No equity in the reseller title" and "no equity,
period" are indistinguishable in that data, so the walk-back was made on a null result
rather than on evidence that the broader framing works.

Once sold comps ships, update in this order:
`B2B_FEATURE_TRUTH.md` §5 → `app/layout.tsx` metadata → `Hero.tsx` →
`faqData.ts` → `PricingCards`. Two claims to lead with, both defensible today:

1. **"Sold prices across 9 marketplaces, including the ones the extensions don't
   cover."** Grailed, Vinted, StockX, Vestiaire are the differentiators. Say them
   by name.
2. **"We're paid by you, not by the marketplaces."** Every competitor in Segment A
   takes affiliate commission on where they send you. One of them was just
   suspended from Impact.com for taking credit it did not earn. Crawli has no
   incentive to rank one marketplace over another, and that is a genuine, checkable
   claim.

### What to deliberately NOT do

- **Do not build a browser extension.** It is the head-on fight with Beni, on their
  surface, with 1/50th the coverage and none of the capital.
- **Do not build visual search.** Beni Lens shipped Dec 2025 on Vertex AI with
  patent-pending claims; Gem's image search already works well per third-party
  comparison. This is a two-year-behind race.
- **Do not chase platform count for its own sake.** 9 well-parsed platforms with
  sold data beats 20 with asking prices.
- **Do not add an affiliate revenue stream.** It is the one thing that would forfeit
  the trust position, and the unit economics are publicly bad.

---

## 6. Value-proposition ledger + experiment log

**This is the live section. Everything above is analysis written once; this gets
updated every time an onboarding or marketing experiment runs.** Its job is to stop
the project from marketing a claim it has not earned, which is exactly what happened
with the 2026-06-29 reseller-only copy.

### 6a. Baseline — frozen 2026-08-07, before any change

Every experiment below is measured against these. Do not re-baseline; add a new row
instead, so drift stays visible.

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

**The two numbers that matter most for onboarding work: 38% one-and-done, and 27%
second-day return.** If an onboarding change does not move those, it did not work,
regardless of how the funnel looks.

### 6b. Claim ledger — what we may and may not say

Marketing copy may only use a claim at **Validated**. Anything at Hypothesis is for
testing, not for the landing page, the metadata, or a carousel.

| # | Claim | Status | Evidence / what would validate it |
|---|---|---|---|
| C1 | "Sold prices across Poshmark, Mercari and Grailed in one place" | **Hypothesis** | Not built. Validates if sold-comps users show higher 2nd-day return than baseline 27%. |
| C2 | "We're paid by you, not by the marketplaces we rank" | **True but untested** | Factually correct today (subscription, zero affiliate code). Untested as a *motivator*. Validates if it measurably lifts signup or is volunteered by users unprompted. |
| C3 | "Alerts with compound criteria (brand AND size AND price)" | **True, unadopted** | `applyCriteria()` ships and works. 2 users. Validates if public alert creation drives adoption above ~30% of new signups. |
| C4 | "Covers marketplaces the extensions don't" (Grailed, Vinted, Vestiaire, Depop) | **True, unvalidated as a reason to switch** | Coverage is real vs Beni's partner list. Nobody has said it made them choose Crawli. |
| C5 | "Know your real margin before you buy" | **Partially true** | `netFlipProfit()` fees are verified, but resale price defaults to average *ask*. Becomes fully true only after Step 1 task 4. |
| C6 | "Best price on a secondhand item" (current landing framing) | **Falsified as a wedge** | Gem and Beni do this better and free. §3. Do not lead with it. |

### 6c. Onboarding experiment log

Append one block per experiment. Write the hypothesis and the kill criterion **before**
shipping, not after reading the result. With ~36 users nothing here will be
statistically significant — these are directional reads, and small-n honesty is part
of the record.

```
### EXP-00N — <short name>
Date started / ended:
Claim under test:            (C1-C6 above, or new)
Hypothesis:                  If <change>, then <metric> moves from <baseline> to <target>.
Change shipped:              (files / commits)
Primary metric:              (pick ONE from 6a)
Kill criterion:              (what result means "stop", decided in advance)
n:                           (users exposed)
Result:                      (number, not a narrative)
Read:                        (what it means; "inconclusive, n too small" is allowed)
Ledger update:               (which claim moved status, if any)
```

**Queued, in order** (revised 2026-08-10 — onboarding flow added as EXP-001; public
alert creation pushed to EXP-005, now gated on EXP-001 *and* EXP-002):

- **EXP-001 — onboarding flow for new signups** (Step 2 item 1). Claim C3. Primary
  metric: **share of new signups, from ship date forward, who create ≥1 alert in
  their first session.** No like-for-like baseline exists yet — onboarding doesn't
  exist today, so this experiment establishes the number. The all-time 2/36 = 6%
  figure is cited for context only, not as a matched baseline.
  **Kill criterion: if fewer than ~15-20% of new signups create an alert even when
  it's offered as an equal first choice next to search, that's evidence against the
  thesis — read together with EXP-002, not alone.**
- **EXP-002 — alert CTA prominence + repeat-search trigger** (Step 2 item 2). Claim
  C3. Primary metric: **share of the pre-existing 24 (searched, never alerted) who
  create one after this ships — baseline 0/24 for that specific cohort.**
  **Kill criterion, decided in advance: if prominent placement plus a repeat-search
  prompt does not convert a meaningful share of that specific 24, alerts are not as
  compelling as this doc assumes, and the entire "alerts as the front door" thesis
  (including Step 2 item 5) needs re-examination rather than another iteration.** This
  population is unaffected by EXP-001 — they already have accounts and never see the
  onboarding screen — so it isolates this change cleanly. See the Measurement note in
  Step 2.
- **EXP-003 — immediate baseline email on first alert run** (Step 2 item 3). Claim C3.
  Primary metric: 2nd-day return, baseline 27%.
- **EXP-004 — sold comps in the margin panel** (Step 1 task 4). Claims C1 + C5.
  Primary metric: searches per user per month, baseline 1.9.
- **EXP-005 — public alert creation** (Step 2 item 5). Claim C3. **Gated on EXP-001
  and EXP-002 both showing alerts convert.** Primary metric: signups, baseline
  ~0.57-1/day (trending toward the higher end as of early Aug).

### 6d. How marketing follows from this

**No channel work starts until a claim reaches Validated.** The sequence, and the
reason the current TikTok/blog motion has produced 39 clicks in 90 days, is that
channel came before claim.

1. **Claim validated in 6b** → then and only then it goes in copy.
2. **Copy updated in the Step 4 order** (`B2B_FEATURE_TRUTH.md` §5 → `app/layout.tsx`
   metadata → `Hero.tsx` → `faqData.ts` → `PricingCards`). `B2B_FEATURE_TRUTH.md`
   stays the source of truth for what is claimable — update it first, always.
3. **Channel chosen to match the validated claim**, not the reverse. If C1 validates,
   the audience is resellers and the channels are r/Flipping, reseller Discords and
   YouTube reseller channels — not SEO, which §5 Step 3 already established is
   capped by AI Overviews on these queries.
4. **The obfuscate-commercial-intent rule in CLAUDE.md was written for the old
   B2C carousel motion.** If the position narrows to resellers, revisit it: that rule
   produced 0 comments across 55 posts (GROWTH_PLAN §1), so it has already failed its
   own stated KPI once.

---

## Sources

- Beni funding, coverage, model: [Retail Dive](https://www.retaildive.com/news/resale-tech-startup-beni-raises-4m/638726) · [PR Newswire](https://www.prnewswire.com/news-releases/beni-raises-over-5m-to-make-secondhand-shopping-easier-than-ever-301700851.html) · [Google Developers Blog](https://developers.googleblog.com/how-recommerce-startup-beni-uses-ai-to-help-you-shop-secondhand/) · [Google for Startups](https://startup.google.com/alumni/stories/beni/)
- Beni Lens: [PR Newswire, 2025-12-10](https://www.prnewswire.com/news-releases/beni-unveils-beni-lens-the-first-visual-search-engine-for-secondhand-fashion--making-thrifting-as-easy-as-shopping-new-302637397.html)
- Gem coverage and features: [Forbes](https://www.forbes.com/sites/sharonedelson/2025/01/20/online-vintage-and-secondhand-search-engine-gem-adds-new-features/) · [gem.app/about](https://gem.app/about)
- Beni vs Gem head-to-head: [All Things Fashion Tech](https://allthingsfashiontech.substack.com/p/over-phias-cookiegate-beni-vs-gem)
- Phia cookie-stuffing: [TechCrunch, 2026-07-10](https://techcrunch.com/2026/07/10/phia-accused-of-cookie-stuffing-taking-affiliate-credit-on-purchases-it-didnt-earn/) · [Inc.](https://www.inc.com/esther-lian/phoebe-gates-startup-phia-accused-cookie-stuffing-what-happens-next/91372500)
- Reseller tooling landscape: [Underpriced AI](https://underpricedai.com/) · [Flowlister](https://flowlister.com/blog/best-reseller-apps/) · [Voolist](https://www.voolist.com/blog/best-vendoo-alternatives)
</content>
</invoke>
