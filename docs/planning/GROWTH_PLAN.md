# Crawli — Growth & Marketing Gameplan

**Created:** 2026-06-30 · **Owner:** Kevin · **Status:** living doc

## How to use this doc

This is the **strategic plan for getting Crawli from ~0 traction to first paying
customers.** It exists so any future session can pick up the work without the
original chat. It is current-state + forward-plan: when you complete a phase,
update its status here and drop a one-liner in `HANDOFF.md` "Recent changes".

Read order for a cold session: this doc → `HANDOFF.md` → the specific file you're
touching. The *product* is feature-complete; this plan is about **distribution
and conversion**, not new features.

---

## 1. The diagnosis (why this plan exists)

Pulled from real data on 2026-06-30 (Supabase project `peyqxfijdrziqfjkxjsn` +
GSC `thecrawli.com` + `tiktok_performance` table). Numbers will drift — re-pull
before trusting them, but the *shape* is the point.

**It is NOT a features problem, and NOT (yet) a marketing-volume problem. It's a
conversion-path + marketing-effectiveness problem.**

| Signal | Value (2026-06-30) | Read |
|---|---|---|
| Total users | 19 | Tiny base |
| Paying / active subs | **0 / 0** | No revenue ever |
| New signups (30d / 14d) | 10 / 6 (~0.3/day) | Slow trickle |
| Lifetime searchers | 13 / 19 (68%) | Activation is **good** |
| Searches per searcher | 7.3 | Engaged users return |
| Saves | 116 — from only **4 users** | Strong PMF in a tiny power core |
| Alerts ("flagship") | **2 total** | Barely adopted |
| Searchers last 7d | 3 | Recent cooling |

**TikTok (the active channel — and it's underperforming):**
- 55 posts, all in an 8-day burst (Jun 16-24), **then went dark**.
- 6,837 total views, **median 89/post**, 111 likes, **0 comments**, 14 shares.
- Documented strategy KPI was "comment inquiries, not clicks" → got **zero comments**. The data falsifies the strategy.
- Best post (1,046 views) = "spot a fake vintage tee" — but Crawli doesn't authenticate. **Content is disconnected from the product**, and intent is obfuscated to the point there's no view→site→signup path.

**SEO/AEO:**
- Impressions climbing (2 → 150/day over June); ~10 clicks in 28 days; ranking page 2-4.
- Ranks **position 6.4 for its own brand term "crawli"** (should be #1). Cause is off-page (domain ~6 weeks old, no backlinks, no entity confirmation) — NOT on-page (on-page is already strong).
- Glossary/blog content pulls informational impressions ("cavalry twill", "deadstock sneakers") with ~0 clicks.

**Voice-of-customer (own `reddit_research` table, 560 rows):** loudest pains are
scam/counterfeit/seller-trust — which **Crawli does NOT solve**. The genuinely
Crawli-shaped pains are quieter: **"search/discovery is bad", "price-comparison
fatigue", "prices too close to retail / can't find underpriced."** Messaging
should hammer those three and ignore the scam noise.

## 2. The thesis

Don't pour more content into a leaky bucket. Fix the drain first:
1. **A working money path** (Stripe live end-to-end).
2. **A public, no-login surface** that delivers value on click (removes the
   signup-wall leak; doubles as SEO/AEO + shareable/backlink asset).
3. **Content that points at the product**, aimed at the 3 real pains.

Volume only helps once 1-3 exist. Engaged users already love it (7.3 searches,
29 saves each) — the job is getting more of the right people to *arrive* and
giving the product a way to *collect money*.

---

## 3. The phased plan

### Phase 0 — Make the money path real ✅ DONE (2026-06-30)
- **Done:** Stripe webhook idempotency guard (`stripe_webhook_events` table,
  claim-with-rollback in `app/api/webhooks/stripe/route.ts`). Verified the
  credit-grant path end-to-end (0→100 on grant, duplicate skipped, no
  double-grant) via new `scripts/test-credit-webhook.mjs`. Migration:
  `docs/migrations/stripe-webhook-idempotency.sql`.
- **Root cause of "credits never granted in dev":** Stripe can't reach
  `localhost` without `stripe listen`. Code was always correct. See
  `docs/core/PITFALLS.md` → Payments for the two local-test methods.
- **✅ Prod Stripe one-time prices provisioned** ($10/$25/$60) and
  `STRIPE_PRICE_PACK_SMALL/MEDIUM/LARGE` set in `/opt/crawli/.env` (confirmed
  2026-06-30). Local `.env` has matching test price IDs.

### Phase 1 — SEO / AEO ✅ CODE DONE (2026-06-30), off-page ONGOING
On-page was already ~90% there (server-rendered JSON-LD: Organization,
WebSite+SearchAction, SoftwareApplication, FAQPage; clean sitemap/robots; strong
metadata). Shipped the gaps:
- **`public/llms.txt`** — AEO descriptor (was 404).
- **`sameAs` + `alternateName`/`foundingDate`** on Organization schema
  (`app/components/StructuredData.tsx`) → entity consolidation for brand rank.
- **Social links in `app/components/landing/Footer.tsx`** (X, TikTok, Instagram,
  Pinterest, `rel="me"`) → crawlable, corroborates `sameAs`.
- All verified in SSR HTML. **Pending deploy** (see deploy cmd below).

**Socials:** x.com/thecrawli · tiktok.com/@thecrawli · instagram.com/thecrawli ·
pinterest.com/thecrawli. (Keep `sameAs` and Footer in sync if these change.)

**⚠️ OWNER TASKS STILL OPEN (off-page — the real brand-rank levers, manual):**
1. Confirm `NEXT_PUBLIC_GSC_VERIFICATION` is set in prod (user believed so).
2. Sitemap + indexing: **done** per owner.
3. **Reddit/forums (highest ROI + #1 AEO lever):** value-first only — build comment
   karma 2-3 wks answering real questions in r/Depop, r/Mercari, r/poshmark,
   r/vinted, r/flipping, r/Vintage, r/streetwear, r/findfashion, THEN mention
   Crawli (link the Phase 2 public page, not a signup wall) ~1 per 10 genuine
   comments. r/flipping & r/SideProject tolerate a story-first "I built this".
4. **Product Hunt:** launch ONCE for the high-DA backlink + visibility day (not
   for ICP customers — PH audience = founders). Prep a 60s demo, gallery,
   founder first-comment, 5-10 early engagers. **Do it after Phase 2 exists** so
   there's a no-login demo.
5. **Directories/lists:** SaaSHub, AlternativeTo (alt to Google Shopping /
   PriceCharting), "best reselling tools" listicles (email authors), Indie
   Hackers build-in-public. Small individual links, collectively build the entity.
- **Do NOT:** buy links, mass-submit directories, drop cold Reddit links, fiverr
  backlink packs. Penalized or useless.

### Phase 2 — Public "compare" page ⏳ NOT BUILT (next, highest leverage)
The keystone. A public, no-login page showing a real cross-platform price
comparison for a specific item. Removes the activation wall AND serves as the
backlink/Reddit/PH/SEO/AEO asset every other channel needs.

**Proposed scope (to confirm with owner before building):**
- **URL:** `/compare/[slug]` e.g. `/compare/north-face-nuptse-jacket`. Must be an
  indexable path — note `robots.ts` currently disallows `/search` and `?q=`
  params, so `/compare/` is intentionally separate and crawlable.
- **Shows:** the item, lowest price per platform, # of listings, price range, a
  few sample cards, "last updated" timestamp. Soft CTA below ("search this live
  / set an alert → sign up").
- **Generation (key open decision):** live-scraping on every visitor is too
  costly and risks the fragile `/api/search` streaming path. Recommended: a
  **curated set of ~10-25 high-intent slugs**, each backed by a **cached
  snapshot** refreshed on a cron (reuse `search_listings_cache` patterns). Start
  hand-picked, then templatize.
- **SEO/AEO:** target "[item] resale price" queries; add `ItemList`/`Offer`
  schema + breadcrumbs; these are exactly the structured, citable pages LLMs
  quote.
- **Open decisions for the building session:** live vs cached (recommend cached);
  how many slugs to seed; refresh cadence; exact data shown; whether sample
  cards deep-link to the live listings; affiliate links (none today).
- **Guardrail:** do not touch the `/api/search` NDJSON streaming protocol or
  `crawl4ai-service/` internals — read `docs/core/SYSTEM_DESIGN.md` +
  `docs/core/PLATFORM_STATUS.md` first.

### Phase 3 — Re-aim + restart content ⏳ NOT STARTED (after Phase 2)
- Stop the obfuscation experiment (data killed it: 0 comments/55 posts).
- Make the **product the payoff**, keep the hook format that worked ("Stop typing
  vintage Levi's 501 into search…" got 301 views) but the reveal = the actual
  capability ("…here's me checking 9 sites in one search, found it $40 cheaper").
- Aim at the 3 real pains (search/discovery, price-comparison fatigue, finding
  underpriced). Point traffic at the Phase 2 page.
- **Post consistently** (channel dark since Jun 24). Use existing carousel
  pipeline (`docs/marketing/POSTS_README.md`, `marketing-visual-diversity` skill,
  `visual-history.json`) but with product-connected angles.
- Respect existing content rules: no em/en-dashes in captions; vary
  fonts/layout/placement each batch; gpt-image-2 cover.

---

## 4. What is explicitly NOT in scope
- **No new product features.** At 19 users / 0 paying, feature work is premature.
  The only thing being "built" (Phase 2 page) is marketing infrastructure.
- **No tier/pricing optimization** until there's a paying base to optimize.
- **No cross-listing, authentication, or escrow** — not what Crawli is (see
  `docs/reference/B2B_FEATURE_TRUTH.md`). Don't let reddit scam-pain data pull the product
  off-thesis.

## 5. Owner action checklist (the human-only items, in priority order)
1. [x] Provision 3 real Stripe one-time prices in PROD + set env vars — **DONE** (confirmed 2026-06-30).
2. [ ] Confirm `NEXT_PUBLIC_GSC_VERIFICATION` set in prod.
3. [ ] Deploy the Phase 0/1 changes (cmd below).
4. [ ] Start the Reddit value-first karma-building (ongoing).
5. [ ] Product Hunt launch — after Phase 2 ships.
6. [ ] Submit to directories / tool lists.

## 6. Key references
- Stripe webhook: `app/api/webhooks/stripe/route.ts` · test: `scripts/test-credit-webhook.mjs`
- Credit packs: `lib/creditPacks.ts` · gate: `app/api/search/route.ts` · checkout: `app/api/billing/credits/route.ts`
- SEO: `app/layout.tsx` (metadata) · `app/components/StructuredData.tsx` · `app/sitemap.ts` · `app/robots.ts` · `public/llms.txt`
- Footer socials: `app/components/landing/Footer.tsx`
- Data: Supabase project `peyqxfijdrziqfjkxjsn`; tables `profiles`, `search_history`, `saves`, `saved_searches`, `tiktok_performance`, `reddit_research`
- GSC: property `https://thecrawli.com/` (MCP `mcp__gsc__*`)
- Deploy: `cd /opt/crawli && git pull && npm install && npm run build && systemctl restart crawli-next` (see `docs/reference/SERVER_REFERENCE.md`)

## 7. Status snapshot
| Phase | What | Status |
|---|---|---|
| 0 | Stripe credits + idempotency | ✅ fully done (code + prod prices) |
| 1 | SEO/AEO code (llms.txt, sameAs, footer) | ✅ done · pending deploy |
| 1 | Off-page (Reddit/PH/directories) | 📋 owner, ongoing, gated on Phase 2 |
| 2 | Public `/compare/[slug]` page | ⏳ not built — NEXT, highest leverage |
| 3 | Re-aimed + restarted content | ⏳ not started — after Phase 2 |
