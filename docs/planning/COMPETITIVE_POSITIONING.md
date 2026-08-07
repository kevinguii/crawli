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

1. **Start with eBay only.** eBay's sold-listings filter (`LH_Sold=1&LH_Complete=1`)
   is the single richest sold-price source and covers most categories including the
   non-fashion queries already in the logs. Note: eBay is Avenue B (Firecrawl) and
   already Akamai-blocks ~1 in 5 — budget for that, and evaluate the eBay Browse /
   Marketplace Insights API as the durable path.
2. **Then StockX**, which publishes explicit last-sale and sale history — the
   cheapest win after eBay and already natively scraped.
3. **Then Poshmark and Grailed**, both of which surface sold listings and both of
   which already have sold-status detection in `structured_extractors.py`.
4. Output the three numbers a flip decision actually needs: **median sold price,
   sell-through rate, days-to-sell**. Feed the median into the existing
   `netFlipProfit()` calculator so the margin panel is grounded in real sales rather
   than live asks.
5. Follow the project workflow for this: `/superpowers:brainstorming` → spec → plan →
   worktree → subagent execution. It is a multi-day change touching the sidecar.

### Step 2 — Make alerts the front door, not search

Alerts are the cheapest feature to run (shared scrape), the stickiest, the one
competitors do worse, and they have 2 users. That ratio is the biggest unforced
error in the product.

1. **Alerts should be the first thing a new user creates, not the fourth.** Today
   onboarding drops users into a search box; 10 of 26 search once and never return.
   An alert is the only artifact that brings someone back on day 2.
2. Move alert creation into the signup flow, and let a **logged-out visitor create
   one with just an email**. Search results are the expensive thing to give away
   free; an alert is nearly free and is a captured email either way.
3. Market the compound criteria explicitly. "Alert me when a Grailed *or* Vinted
   listing matches brand=Stussy, size=M, under $80" is something neither Beni nor
   Gem can express.

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

### Step 4 — Rewrite positioning after Step 0 confirms, not before

Once the audience question is settled, update in this order:
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

## Sources

- Beni funding, coverage, model: [Retail Dive](https://www.retaildive.com/news/resale-tech-startup-beni-raises-4m/638726) · [PR Newswire](https://www.prnewswire.com/news-releases/beni-raises-over-5m-to-make-secondhand-shopping-easier-than-ever-301700851.html) · [Google Developers Blog](https://developers.googleblog.com/how-recommerce-startup-beni-uses-ai-to-help-you-shop-secondhand/) · [Google for Startups](https://startup.google.com/alumni/stories/beni/)
- Beni Lens: [PR Newswire, 2025-12-10](https://www.prnewswire.com/news-releases/beni-unveils-beni-lens-the-first-visual-search-engine-for-secondhand-fashion--making-thrifting-as-easy-as-shopping-new-302637397.html)
- Gem coverage and features: [Forbes](https://www.forbes.com/sites/sharonedelson/2025/01/20/online-vintage-and-secondhand-search-engine-gem-adds-new-features/) · [gem.app/about](https://gem.app/about)
- Beni vs Gem head-to-head: [All Things Fashion Tech](https://allthingsfashiontech.substack.com/p/over-phias-cookiegate-beni-vs-gem)
- Phia cookie-stuffing: [TechCrunch, 2026-07-10](https://techcrunch.com/2026/07/10/phia-accused-of-cookie-stuffing-taking-affiliate-credit-on-purchases-it-didnt-earn/) · [Inc.](https://www.inc.com/esther-lian/phoebe-gates-startup-phia-accused-cookie-stuffing-what-happens-next/91372500)
- Reseller tooling landscape: [Underpriced AI](https://underpricedai.com/) · [Flowlister](https://flowlister.com/blog/best-reseller-apps/) · [Voolist](https://www.voolist.com/blog/best-vendoo-alternatives)
</content>
</invoke>
