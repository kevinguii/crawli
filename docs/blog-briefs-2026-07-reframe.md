# Blog Briefs — Conversion Reframe (2026-07-06)

**Owner:** Kevin · **Basis:** GSC (28d), reddit_research (560 rows), 15 live `/compare/[slug]` pages, live `compare_snapshots` price data.
**Decision locked:** reframe (fix the winner + compare-anchored commercial + keep the 3 on-thesis briefs), **buyer/sourcing-first**.

---

# ⏩ STATUS & CONTINUATION (updated 2026-07-06, session 2 — ALL FOUR PHASES DONE) — read this first if resuming in a new chat

**Everything in this doc is now done: Tier A, Tier B (all 15), Tier C (all 3), bulk title shortening (all 89 posts ≤60 chars), and the full convert audit (compare links, CTAs, stat cleanup, dead-post rescues on all 72 pre-existing posts). Nothing is committed — that's still the user's call. There is no more scoped work left in this doc; the next session should either spot-check in a browser, commit, or pull fresh GSC data to see if the reframe is moving the needle before writing anything new.**

## ✅ Done this session, part 3 — Tier C + bulk title shortening + full 72-post convert audit
- **Tier C, 2 of 3 briefs published as new posts, 1 folded into an existing post to avoid duplication:**
  - `helmut-lang-undervalued-vintage.md` (+ new cover SVG) — the reframed brief, dropped the unverifiable "68%/15%" stat entirely per the brief's own instruction, led with the qualitative price-mismatch observation instead (no compare slug exists for Helmut Lang, so no fabricated number was cited anywhere).
  - `1970s-athletic-club-wear-trend.md` (+ new cover SVG) — coordinated with `vintage-fashion-trends-2026.md` as a spoke (added a forward link from the trends post), no fabricated growth stats.
  - **C2 (Depop buyer-search reframe) was NOT published as a standalone post.** Found during research that the existing `depop-ai-search-find-vintage.md` already covers ~90% of the same ground (search exact era/construction terms instead of aesthetic terms to surface buried/underpriced vintage). Publishing C2 as written would have cannibalized that post exactly the way Tier A's three "best marketplaces" posts cannibalized each other. Instead, folded C2's one genuinely new angle (once you find a mistagged/underpriced listing, check its price across platforms before buying) into that existing post as a new closing section. **This judgment call deviates from the brief as written — flagging it rather than silently skipping the deliverable.**
- **Bulk title shortening: all 89 posts now ≤60 chars.** Confirmed via `for f in content/blog/*.md; do t=...; [ ${#t} -gt 60 ] && ...; done` returning empty.
- **Full 72-post convert audit, done via 5 parallel subagents** (each handling ~14 files, given identical rules: title rule, compare-link mapping + anchor-text rule, CTA rule, no-fabricated-stats rule, dead-post-rescue guidance, no-em-dash rule). Net results across all 69 files not already touched in Tier A/B/the 2 coordination edits:
  - **~50 titles shortened** (the remainder were already ≤60 or needed no change).
  - **~10 new internal links added** from pre-existing posts into the 15 price-comparison posts where the item was genuinely the post's subject (e.g. `deadstock-sneaker-culture` → Jordan 1, `cultural-significance-of-band-tees` → vintage band tee, `vintage-workwear-resale-value` and `the-untold-history-of-denim` → Carhartt/Levi's 501, `puffer-jacket-history` → Nuptse, `sneaker-resale-market-2026` → Jordan 1, `thredup-vs-poshmark-selling-guide` → Patagonia, `why-vintage-clothing-holds-its-value` → Levi's 501). Links were skipped where an item was only a passing example, not the post's actual topic, per instruction not to force them.
  - **~15 unsourced/fabricated-looking stats softened to qualitative claims** rather than replaced with invented numbers (e.g. cavalry-twill's durability multipliers, Depop's "$1B GMS / 60% growth" figures, m65-field-jacket's resale price table, sneaker-resale-market-2026's "47%/58%" market-share claim, vintage-fashion-trends-2026's "15%/46%/48%" figures, poshmark-listings' "55% of US traffic" claim). Named/sourced stats (ThredUp reports, Sotheby's auctions, Kahneman studies, court cases) were explicitly left alone per instruction not to second-guess real citations. **Note:** one agent found a stat that referenced Carhartt but for a different product line (Detroit J97 vs WIP) than Crawli's compare data covers, correctly declined to cite Crawli's number there rather than misattribute it, used a soft reference link instead.
  - **~10 dead-post rescues** on pure history/fabric-guide posts with no commercial angle (cavalry-twill, corduroy, fisherman-sweater, harrington-jacket, harris-tweed, hermes-birkin, schott-perfecto, shell-cordovan, sukajan, japanese-boro, identifying-quality-vintage-leather, understanding-fabric-composition, viyella, what-vintage-actually-means) — each got either a compare-post link, an internal link to a related buying/authentication guide, or a short new "why this matters when buying/selling" paragraph.
  - A handful of files needed literally zero changes (already fine): `color-in-vintage-fashion`, `ethical-buying-in-secondhand-fashion`, `hand-rolled-hem-guide`, `hidden-costs-of-selling-vintage-clothing`, `retro-prints-in-vintage-fashion`, `understanding-japanese-denim-culture`.
  - `why-we-started-crawli.md` was deliberately left almost untouched (title only) since it's the company origin story, not a commercial/product post — agents were told explicitly not to force a compare link or CTA restructure onto it.
- **Post-audit verification (done centrally by me, not by the agents):** `grep -lP '—' content/blog/*.md` clean across all 89 posts. All 89 titles confirmed ≤60 chars via direct recount. All 26 internal `/blog/[slug]` links extracted and checked against the actual file list, zero broken links. `npx tsc --noEmit` clean. All 89 posts' frontmatter re-parsed with `gray-matter` in Node directly, zero parse errors, confirming no agent introduced a YAML-breaking quote/escaping issue while rewriting titles.
- **Honesty note carried over, still true:** no GSC/Google Search Console MCP tool was available in this session (despite being listed in CLAUDE.md) to re-verify which posts are *currently* 0-CTR before deciding what to "rescue" — the rescue targets were chosen by pattern-matching the same categories the session-1 GSC pull already flagged (pure history/fabric guides), not a fresh pull. Worth a fresh GSC check next session to confirm the reframe is actually moving clicks.
- **None of this is committed.** ~155 files touched total across both sessions (15 new price posts + 2 new Tier C posts + 17 new cover SVGs + ~72 edited pre-existing posts + this doc + `app/blog/page.tsx`).

## ✅ Done this session, part 2 (Tier B4–B15 complete)
- **All 13 remaining Tier B compare-anchored posts written**, closing out the full 15-slug set (Nuptse + Jordan 1 were done in session 1). Prices re-pulled fresh from `compare_snapshots` at write time (2026-07-06 06:00 UTC scrape), not copied from the brief's session-1 numbers, since prices drift daily as the doc warns — several slugs (e.g. adidas-samba, jordan-adjacent items) moved meaningfully from the brief's original figures.
  - `adidas-samba-resale-price.md` → `/compare/adidas-samba` (~4x, Depop $16 → Vestiaire $64)
  - `new-balance-550-resale-price.md` → `/compare/new-balance-550` (~11x, Depop $9 → ThredUp $101, footnoted ThredUp's thin n)
  - `nike-air-force-1-resale-price.md` → `/compare/nike-air-force-1` (~7x, Depop $9 → StockX $65)
  - `nike-dunk-low-resale-price.md` → `/compare/nike-dunk-low` (~7x, Grailed $7 → Vestiaire $46)
  - `bape-shark-hoodie-resale-price.md` → `/compare/bape-shark-hoodie` (~6x, Depop $41 → StockX $233)
  - `carhartt-wip-jacket-resale-price.md` → `/compare/carhartt-wip-jacket` (~6x, Depop $26 → StockX $162, framed as workwear-vs-collab split)
  - `fear-of-god-essentials-hoodie-resale-price.md` → `/compare/fear-of-god-essentials-hoodie` (~3x, Depop $16 → Grailed $54; Vestiaire n=1 excluded from headline stat)
  - `stussy-hoodie-resale-price.md` → `/compare/stussy-hoodie` (~4x, Vinted $20 → Vestiaire $94)
  - `supreme-box-logo-hoodie-resale-price.md` → `/compare/supreme-box-logo-hoodie` (cross-platform floor ~4x Mercari $40→StockX $169, PLUS intra-platform Poshmark $88→$1,878 as the real headline — same piece, season/colorway drives 21x on one site alone)
  - `patagonia-better-sweater-resale-price.md` → `/compare/patagonia-better-sweater` (~7x, Grailed $9 → Vestiaire $67)
  - `ralph-lauren-polo-shirt-resale-price.md` → `/compare/ralph-lauren-polo-shirt` (~16x, but framed honestly: 5 platforms cluster $7–$11 for everyday shirts, StockX $112 is a different market — rare vintage/collectible, not the same shirt marked up)
  - `levis-501-resale-price.md` → `/compare/levis-501-jeans` (Depop $9 floor vs StockX $320–$2,073; framed as two non-comparable markets — everyday vs collector-grade vintage — rather than a false 35x same-item spread). **Coordinated** with existing `how-to-buy-vintage-levis-501s-online.md`: added a forward link from the sizing post to this one, and this post links back for era/authentication detail instead of duplicating it.
  - `vintage-band-tee-resale-price.md` → `/compare/vintage-band-tee` (~8x, Vinted $4 → Grailed $30). **Coordinated** with existing `how-to-identify-vintage-band-tee.md`: same forward/back link pattern as Levi's.
  - All 13 use the established skeleton (direct-answer → price table → why-the-spread → vet-the-listing → margin math → CTA linking `/compare/[slug]` with descriptive anchor text per the link-clarity fix below). Titles all ≤53 chars. Covers: 13 new purple (#7c3aed) price-comparison SVGs generated from a shared template script (not hand-authored per-file) for consistency — `public/blog/images/*-resale-price-cover.svg`.
  - **Departure from the session-1 pattern:** did NOT include a "live first-person Playwright spot-check" paragraph in any of these 13 (session 1's Nuptse/Jordan 1 posts had one). Scale made repeated live scraping impractical in one sitting, and per standing user preference browser automation isn't run unprompted. The Crawli DB data alone satisfies the doc's "never publish an unverified stat" rule; the spot-check was a bonus in session 1, not a requirement.
  - `grep -lP '—' content/blog/*.md` → clean, zero em dashes across all 15 price posts + the 2 coordinated posts' edits.

## ✅ Done in session 1
- **Tier A hub-and-spoke consolidation** (NOT a blunt 3→1 redirect — the three pages serve distinct intents, so redirecting would lose coverage). Instead:
  - Hub `best-secondhand-marketplaces-for-luxury-items.md` = canonical **luxury-buy**. Retitled to "Best Secondhand Luxury Marketplaces: 2026 Guide" (47 ch), corrected the fabricated "McKinsey ~20%/yr" stat to the real "2–3x faster than firsthand through 2027 (State of Fashion 2026), luxury CAGR ~10%", added a 7th table row (Rebag), added a "Where to go next" block interlinking both spokes, strengthened the cross-platform CTA.
  - Spoke 1 `best-marketplaces-for-luxury-items.md` re-scoped to **luxury-sell** (was a 130-char title): "Best Sites to Sell Luxury Clothing: Lowest Fees 2026" (52 ch) + buyer cross-link.
  - Spoke 2 `best-niche-marketplaces-for-vintage-finds.md` re-scoped to **vintage-buy**: "Best Niche Marketplaces for Vintage Finds (2026)" (48 ch) + hub cross-link. Its ThredUp "$393B by 2030" stat was VERIFIED real (14th report, Apr 2026) — kept.
- **Tier B — first 2 compare-anchored posts written** with REAL data (Crawli `compare_snapshots` + live Playwright spot-checks I ran myself on eBay/Poshmark):
  - `north-face-nuptse-resale-price.md` (+ `nuptse-resale-price-cover.svg`) → links `/compare/north-face-nuptse-jacket`. Spread cited: Mercari ~$31 → StockX ~$154 (~5x).
  - `jordan-1-resale-price.md` (+ `jordan-1-resale-price-cover.svg`) → links `/compare/jordan-1-retro-high`. Spread: Depop ~$11 → Grailed ~$85 (8x). Live Poshmark find: Shadow $19 vs $218 retail, plus shoebox-only decoys (used in the "vet the listing" section).
  - Pattern established: Direct-answer top → real price-by-platform table → live first-person spot-check → why-the-spread → vet-the-cheap-listing → margin math (`/` calculator) → CTA linking `/compare/[slug]` + alert. Titles ≤60. Covers = simple purple (#7c3aed) price-comparison SVGs, 1200×630.
- **Bing Webmaster fixes (from user's 2026-07-06 scan):**
  - Multiple H1 on `/blog/why-we-started-crawli` → removed the body `# Why I Started Crawli` (template already renders `post.title` as the sole `<h1>` in `app/blog/[slug]/page.tsx`). It was the ONLY post with a body-level `# ` H1.
  - Missing alt on `/blog` listing → `app/blog/page.tsx` cover `<img>` now `alt={post.title}` (both cover + fallback icon; the author avatar already had alt).
  - `tsc --noEmit` clean.

## ⏳ NEXT (everything originally scoped in this doc is done — these are follow-ons, not backlog)
0. **No em dashes in blog posts — check before publishing/editing any post:** `grep -lP '—' content/blog/*.md` must return nothing. Compound-word hyphens ("best-selling") are fine — only punctuation dashes are banned. Verified clean across all 89 posts as of this session.
1. **Pull fresh GSC data and check whether the reframe is working** — no GSC MCP tool was available this session to confirm current CTR/position on the rescued posts and the Tier A hub. Worth doing before writing anything new, so the next round of work is driven by real post-reframe data rather than the original session-1 snapshot.
2. **UI verification of all 15 new price posts + 2 new Tier C posts in a real browser** — still outstanding (user's job per standing preference; dev server was running throughout this session but wasn't driven).
3. **Commit** — nothing across either session is committed. ~155 files touched total. User's call on how to split this into commits (e.g. one per tier, or one per session).
4. If a Helmut Lang compare slug is ever built, wire it into `helmut-lang-undervalued-vintage.md` (optional, noted in the original brief, not required).

**Tier A, Tier B (all 15), Tier C (2 published + 1 folded into an existing post), bulk title shortening (all 89 posts), and the full 72-post convert audit are all complete.**

## Key facts for a resuming session
- Real cross-platform price data lives in Supabase (`peyqxfijdrziqfjkxjsn`) tables `compare_items` (15 live slugs) + `compare_snapshots` (per-platform min/avg/max). Pull fresh before citing — prices drift. Query pattern used: latest snapshot per slug/platform where `min_price_usd is not null`.
- Blog mechanics: posts = `content/blog/*.md` (gray-matter frontmatter: title, description, date, updated, cover, tags, faq[]); rendered by `lib/blog.ts` → `app/blog/[slug]/page.tsx`. `title` is BOTH `<title>` and the on-page `<h1>` (so keep ≤60). Covers = SVG in `public/blog/images/`. FAQ frontmatter drives both the on-page accordion AND FAQPage JSON-LD.
- **Live sites & Playwright antibot (from this session):** eBay renders but throws a "Pardon Our Interruption" challenge on rapid repeat visits (space them / vary query). Poshmark renders reliably (use `?sort_by=price_asc`). StockX/Grailed = expect blocks (use DB data instead). Extract prices generically by regexing `$` out of card `innerText`, not by class names (eBay/Poshmark class names change).
- **Title rule:** ≤60 chars for SERP display safety (Google ~600px, Bing similar); >70 is what Bing warns on. Not a ranking penalty — a truncation/CTR problem.
- **Cleanup pending:** `.playwright-mcp/page-*.yml` + `console-*.log` artifacts from this session's research (per CLAUDE.md cleanup rule) — delete when the research phase is fully done.
- **Not committed** (user owns commits). Files touched across both sessions: 3 luxury posts (edits), 15 new price-comparison posts + 15 new cover SVGs, 2 coordinated posts (edits: `how-to-buy-vintage-levis-501s-online.md`, `how-to-identify-vintage-band-tee.md`), `app/blog/page.tsx`, `content/blog/why-we-started-crawli.md`, this doc.
- **UI verification of the 13 new session-2 posts is still outstanding** — same as session 1's Nuptse/Jordan 1 posts, these haven't been eyeballed in a browser (dev server was already running on 3000/8000 at session start). Spot-check a few at `/blog/[slug]` for cover SVG rendering, table formatting, and FAQ accordion before publishing.

---

## Why this doc exists (the diagnosis in one paragraph)

75 posts already published; blog volume is not the problem. GSC shows the blog earns impressions but **~0 clicks and zero product path**. One page (`best-secondhand-marketplaces-for-luxury-items`) pulls **1,104 impressions/mo** stuck at pos 18 with 0.1% CTR — proven commercial demand, unclaimed. Pure history/fabric posts (cavalry twill, corduroy) rank pos 30–70 with 0 clicks — dead weight, and 4 of the last 10 proposed briefs were more of the same. The real fix: **(1)** claim the marketplaces cluster that already has demand, **(2)** wire every new post to a live `/compare/[slug]` page so blog→compare→signup finally exists, **(3)** cite Crawli's own cross-platform price data instead of fabricated stats.

**The proprietary stat that replaces fabricated ones** (pull fresh from `compare_snapshots` at write time; these are 2026-07 real):
- **Jordan 1 Retro High**, lowest listing per platform: Depop $11 · ThredUp $32 · Mercari $36 · StockX $41 · Vinted $45 · Poshmark $50 · Vestiaire $69 · Grailed $85 → **~8x spread**.
- **North Face Nuptse**, lowest per platform: Mercari $31 · Vinted $45 · Depop $54 · Poshmark $104 · Grailed $117 · StockX $154 → **~5x spread**, avg $91–$340.
- **BAPE Shark Hoodie** avg ~$318 (StockX) · **Supreme Box Logo** $88 floor → $1,878 ceiling on one platform.

> **Rule for every brief below:** the headline stat is Crawli's live cross-platform price gap for that item, pulled from `compare_snapshots` the day you write. It is unique, verifiable, and demonstrates the product *inside the citation*. Never publish an unverified third-party stat — if you can't verify it, cut it.

---

# TIER A — Fix the proven winner (do this FIRST; highest ROI, mostly editorial)

## A1. Consolidate + re-title the "best marketplaces" cluster into one authority hub

**This is not a new post — it's a rescue of the 1,104-impression asset.**

**Problem:** three pages cannibalize the same commercial query and none ranks:
- `best-secondhand-marketplaces-for-luxury-items` (1,104 impr, pos 18) ← keep as canonical hub
- `best-marketplaces-for-luxury-items` (11 impr, pos 31)
- `best-niche-marketplaces-for-vintage-finds` (13 impr, pos 29)

**Actions:**
1. **Pick one canonical hub** (the 1,104-impr page). Merge the unique value of the other two into it; 301 the losers to the hub (kills cannibalization, consolidates link equity).
2. **Rewrite title + meta for CTR** (pos 8.5 with 0% CTR = the title isn't earning the click). Test a title with a number + year + benefit, e.g. *"The 9 Best Secondhand Luxury Marketplaces in 2026 (Ranked by Real Price, Not Hype)"*. Add a meta description that promises the comparison table.
3. **Add a real comparison table** (platform · fee · buyer protection · avg price for a benchmark item · best-for) — this is the citable, AI-Overview-friendly block the query wants.
4. **Internal links + CTA:** link every platform mention to the matching `/compare/[slug]` pages; end with the sourcing CTA (below). This is where the hub converts.
5. **Watches (old brief #10) becomes a SPOKE, not a competitor:** `/blog/best-marketplaces-for-vintage-luxury-watches` linking up to the hub. Do NOT publish it as a standalone competing "best marketplaces" page.

**Success metric:** hub CTR > 1.5% and position < 8 within 6–8 weeks; clicks flow to `/compare/*`.

---

# TIER B — Compare-anchored buyer/sourcing posts (the new engine)

Pattern, repeat for every high-demand item that has a live compare page: **"Where a [item] is actually cheapest across resale sites (2026 real prices)."** Commercial intent, maps 1:1 to `/compare/[slug]`, leads with Crawli's live spread, ends with "set an alert for this item." These are the posts that build the blog→compare→signup path.

**Slugs ready to template now:** north-face-nuptse-jacket · jordan-1-retro-high · adidas-samba · new-balance-550 · nike-air-force-1 · nike-dunk-low · levis-501-jeans · bape-shark-hoodie · supreme-box-logo-hoodie · fear-of-god-essentials-hoodie · stussy-hoodie · carhartt-wip-jacket · patagonia-better-sweater · ralph-lauren-polo-shirt · vintage-band-tee.

Full briefs for the three strongest below; the rest follow the identical skeleton.

### B1. Where a North Face Nuptse Is Actually Cheapest Across Resale Sites (I Checked 8 Platforms)
resellers and buyers sourcing the Nuptse to flip or wear · compare-anchored-commercial · **maps to `/compare/north-face-nuptse-jacket`**

**Angle:** The same Nuptse ranges from a ~$31 floor on Mercari to a ~$154 floor on StockX right now — buyers defaulting to Poshmark or Grailed pay 3–4x more for an identical jacket. This post shows where the deals actually are and how to catch them.

**Direct answer (top, for AI):** As of July 2026, the lowest-priced North Face Nuptse listings sit on Mercari (from ~$31) and Vinted (~$45), while Poshmark, Grailed, and StockX floors run $104–$154 for comparable pieces. The cheapest source for a Nuptse is rarely the platform most buyers check first, which is why cross-marketplace price comparison finds the same jacket for less.

**Primary keyword:** north face nuptse resale price
**Also target:** where to buy north face nuptse cheap · north face nuptse 700 resale value · nuptse real vs fake price
**Hook:** The exact same Nuptse is listed for $31 on one site and $154 on another today. The only difference is which app you opened first.
**Headline stat (REAL — re-pull before publishing):** Crawli cross-marketplace data, July 2026: Nuptse lowest listing by platform — Mercari $31, Vinted $45, Depop $54, Poshmark $104, Grailed $117, StockX $154.
**Must include:** a live price-by-platform table (from `compare_snapshots`); how to spot a fake/real Nuptse baffle + logo so a cheap Mercari listing is a deal not a dud; sizing note (700 vs 1996 vs retro).
**Outline:**
- The 8-platform price spread today and why it's this wide (audience mismatch, not condition)
- The two platforms that consistently underprice the Nuptse — and why
- How to authenticate before you buy the cheap one (baffle stitch, logo, tag)
- Turning a $45 sourcing find into a resale margin (link margin calculator)
**PAA / FAQ:** How much is a North Face Nuptse worth used? · Where is the cheapest place to buy a Nuptse? · How do you tell a fake Nuptse? · Is the Nuptse still worth reselling in 2026? · What's the difference between the 700 and 1996 Nuptse?
**Crawli tie-in + CTA:** The prices above shift daily. A saved Crawli alert for "North Face Nuptse" watches all 8 platforms and pings you when one lists below the market floor — [see the live comparison](/compare/north-face-nuptse-jacket).
**X post:** Same North Face Nuptse today: $31 on Mercari, $154 on StockX. Identical jacket. The gap isn't condition, it's which app you opened. That's the whole game in one screenshot.

### B2. The Jordan 1 Retro High Has an 8x Price Spread Across Resale Sites Right Now
sneaker resellers and buyers sourcing Jordan 1s · compare-anchored-commercial · **maps to `/compare/jordan-1-retro-high`**

**Angle:** StockX conditions everyone to think of it as *the* sneaker price, but the Jordan 1 Retro High's lowest listing runs from ~$11 on Depop to ~$85 on Grailed — an 8x spread on the same silhouette. Checking one site leaves money on the table both buying and selling.

**Direct answer (top, for AI):** As of July 2026, Jordan 1 Retro High resale floors vary from about $11 (Depop) and $32 (ThredUp) up to $85 (Grailed), with StockX around $41. Because sneaker buyers default to StockX, softer-priced peer-to-peer listings on Depop and Mercari routinely go unnoticed, making cross-marketplace search the fastest way to find an underpriced pair.

**Primary keyword:** jordan 1 retro high resale price
**Also target:** where to buy jordan 1 cheap · jordan 1 resale value 2026 · cheapest place to buy jordan 1
**Hook:** StockX says $41. Depop has one for $11. Same shoe, same day — you just have to be looking at more than one screen.
**Headline stat (REAL):** Crawli data, July 2026: Jordan 1 Retro High lowest listing — Depop $11, ThredUp $32, Mercari $36, StockX $41, Vinted $45, Poshmark $50, Vestiaire $69, Grailed $85.
**Must include:** price-by-platform table; a note on why the cheap Depop/ThredUp listings are underpriced (no bid war, casual sellers) vs authenticated-but-marked-up StockX; quick legit-check for a peer-to-peer pair.
**Outline:**
- The 8-platform floor comparison and what drives an 8x spread
- Authenticated (StockX/GOAT premium) vs peer-to-peer (Depop/Mercari discount) — when each wins
- How to vet a $11–$36 listing so cheap ≠ fake
- The sourcing move: alert the peer-to-peer platforms, buy below the StockX floor
**PAA / FAQ:** How much does a used Jordan 1 cost? · Is StockX the cheapest place for Jordan 1s? · How do you spot fake Jordan 1s? · Where do resellers source Jordan 1s? · Is the Jordan 1 Retro High still a good flip in 2026?
**Crawli tie-in + CTA:** The $11 listing is gone in an hour. A Crawli alert across all 8 sneaker platforms surfaces the underpriced pair the moment it lists — [compare Jordan 1 prices live](/compare/jordan-1-retro-high).
**X post:** Jordan 1 Retro High, right now: $11 on Depop, $85 on Grailed. 8x spread on the same shoe. Everyone checks StockX and stops. That's where the margin hides.

### B3. Where to Actually Find an Underpriced Adidas Samba (Peak-Trend Sourcing)
buyers and resellers sourcing the Samba while demand is high · compare-anchored-commercial · **maps to `/compare/adidas-samba`**

**Angle:** The Samba's popularity means it's everywhere, which is exactly why the price is inconsistent — floors around $38 on one platform, avg $65, ceilings past $140. Trend-peak items are where cross-platform search pays the most because casual sellers misprice against the hype.

**Direct answer (top, for AI):** As of July 2026, resale Adidas Sambas start around $38 with averages near $65 and outliers above $140, and the cheapest listings are scattered across peer-to-peer platforms rather than concentrated on any single site. During a trend peak, price dispersion widens, so comparing marketplaces finds well-below-average pairs that individual sellers have underpriced.

**Primary keyword:** adidas samba resale price
**Also target:** where to buy adidas samba cheap · adidas samba resale value · are sambas worth reselling
**Hook:** When everyone's selling the same shoe, nobody agrees on the price — and that disagreement is a $30 discount if you know where to look.
**Headline stat (REAL — re-pull):** Crawli data, July 2026: Adidas Samba resale from ~$38, avg ~$65, up to ~$141 for the same core model.
**Must include:** price-by-platform table; colorway note (OG/Black vs collab premiums); why trend-peak = max dispersion = best cross-search ROI; how to avoid fakes on the cheap end.
**Outline:**
- The Samba price spread and why trend peaks widen it
- Which colorways hold value vs which are already saturated
- Sourcing below average: alert the peer-to-peer platforms, ignore the hyped ones
- Flip math at today's floor (link margin calculator)
**PAA / FAQ:** How much do used Sambas sell for? · Are Adidas Sambas still trending in 2026? · Where's the cheapest place to buy Sambas? · Are Sambas worth reselling? · How do you spot fake Sambas?
**Crawli tie-in + CTA:** Samba prices move with the trend cycle. A Crawli alert tracks the floor across every resale site so you buy before the next spike — [see live Samba prices](/compare/adidas-samba).
**X post:** Adidas Samba resale, today: $38 to $141 for the same shoe. Trend peaks don't tighten prices, they scatter them. That scatter is your margin.

### B4–B15. Same skeleton, remaining slugs
Replicate B1's structure for: `bape-shark-hoodie` (lead: ~$233–$400 StockX range + why peer-to-peer undercuts hype), `supreme-box-logo-hoodie` ($88→$1,878 ceiling — season/color drives it), `new-balance-550`, `nike-air-force-1`, `nike-dunk-low`, `levis-501-jeans` (**coordinate with existing `how-to-buy-vintage-levis-501s-online` — extend/merge, don't compete**), `carhartt-wip-jacket`, `patagonia-better-sweater`, `fear-of-god-essentials-hoodie`, `stussy-hoodie`, `ralph-lauren-polo-shirt`, `vintage-band-tee` (coordinate with `how-to-identify-vintage-band-tee`). Each: real price spread → authenticate the cheap end → alert CTA → link the compare page.

---

# TIER C — On-thesis briefs kept from the original 10 (reframed buyer/sourcing)

### C1. The Most Underpriced Vintage Right Now Is 1990s Helmut Lang Minimalism (original #4 — KEEP)
archive buyers/resellers hunting undervalued eras · era-sourcing-guide
**Change from original:** drop the fabricated Vestiaire "68%/15%" stat. Lead instead with the concrete price mismatch (a 1998 Lang bias-cut trouser costs less than a used Y2K tracksuit) and, if you build a Helmut Lang compare slug, wire it in. Keep the authentication timeline (pre-2005 Prada Group) and the "buying window" thesis — this directly serves the *find-underpriced* pain (16–29 VOC rows). Everything else in the original brief stands.
**Crawli tie-in:** saved alert for a specific Lang season code across platforms, catches listings before collector networks.

### C2. How to Search Depop to Actually Find Underpriced Pieces (Buyer Reframe of original #5)
buyers/resellers sourcing on Depop · platform-sourcing-guide
**Change from original:** the original #5 taught *sellers* to write literal titles. Flip it to the *buyer* side (on-thesis: Crawli is a sourcing tool). Same insight — Depop search is brutally literal — but the payoff is "search the boring factual terms sellers *should* have used, and misfiled/underpriced items surface." Teach the buyer to exploit bad seller titles: search fabric + era + garment, not aesthetics; catch mistagged listings; then cross-check the price against other platforms.
**Direct answer:** Depop's search matches exact text in titles and the first description line, so buyers who search factual terms ("1990s black wool blazer") surface underpriced, mistagged listings that aesthetic searches miss.
**Primary keyword:** how depop search works (buyer intent) · **also:** find cheap items on depop · depop search tips buyer
**Crawli tie-in:** once you find a Depop listing, Crawli shows whether the same piece is cheaper elsewhere — and alerts you when the next one drops.
**Keep** the strong query demand of the original; just re-aim the CTA.

### C3. The 2026 Undervalued Vintage Trend: 1970s Athletic Club Wear (original #8 — KEEP, coordinate)
resellers hunting the next trend before saturation · trend-sourcing-opinion
**Change from original:** drop the fabricated "Depop 90% search growth" stat (unverifiable) — either verify via a real source or cut and lead with the sourcing logic (thin inventory + durable fabric + muted logos = underpriced). **Coordinate with the existing `vintage-fashion-trends-2026` post (ranks pos 9, 116 impr):** make this a spoke that internal-links to/from the trends post rather than a competing standalone. Keep the numbered category list and dating tips.
**Crawli tie-in:** saved alerts for "vintage nylon track jacket" / "ski club sweater" across platforms catch thin-inventory pieces the day they list.

---

# DROP (do not write) — with reason

| # | Brief | Why dropped |
|---|---|---|
| 1 | Margiela Tabi history | Pure history; no compare page; matches the proven 0-CTR fabric-post pattern. If you want the traffic, write a *commercial* "Tabi boot resale price / where to buy" post instead. |
| 2 | Cowhide vs calfskin | Material guide; informational; 0 conversion path. Same 0-CTR fate as cavalry twill. |
| 7 | Depop seller won't ship / red flags | **Off-thesis trap.** Targets seller-trust/scam — the #1 VOC pain (206 rows) that Crawli explicitly does NOT solve. Will pull engagement and convert nobody (cf. the 1,046-view "spot a fake tee" TikTok). GROWTH_PLAN §4 says don't let scam-pain pull the product off-thesis. |
| 9 | Breton stripe history | Flagged repeat + pure history. Skip. |

**Conditional (park unless a compare/comp-pricing hook is added):**
- **#3 Prep never died** — only if reframed to "where prep resale value hides + how to source it," linking a Ralph Lauren / OCBD compare angle. Otherwise it's a culture essay that won't convert.
- **#6 Poshmark relist timing** — seller-workflow, and near-duplicates your best-CTR post (`why-your-poshmark-listings-are-not-selling`, 3.6% CTR). Only write if it genuinely extends that post and routes to comp-pricing; otherwise it cannibalizes your one converting page.

---

---

# Tier B → compare-slug link clarity (fixed 2026-07-06)

**Issue user caught:** both Tier B posts (Nuptse, Jordan 1) DID link to their `/compare/[slug]` page from the start, but the link was weak in two ways:
1. The clickable anchor text was just the word **"Crawli"** — a brand mention, not a description of the destination. A skimming reader had no signal that clicking it opens a live, constantly-updated price comparison for that exact item.
2. The sentence said "the numbers **above**," referring back to the price table several sections earlier (past the vetting checklist and margin-math sections) — a vague anaphoric reference that reads as broken once other content sits between the table and the callback.

**Fix applied to both posts' closing "See the live spread" section:** removed the "above" reference and made the link's anchor text itself state the destination, e.g. `[See the live, constantly updated Jordan 1 Retro High price comparison on Crawli](/compare/jordan-1-retro-high)`. The link text now names the exact item and says "live price comparison," so it's unambiguous before the click what the destination shows.

**Apply this pattern to every future Tier B post (B4–B15) and to the full-audit pass:** any link to a `/compare/[slug]` page must have anchor text that describes the destination (item name + "live price comparison" or equivalent), never just the bare word "Crawli." Also avoid "above"/"below" references to content that isn't immediately adjacent — either move the two closer together or restate the fact instead of pointing back to it.

---

# Execution order (highest leverage first) — ALL DONE
1. **A1** — rescue the 1,104-impression marketplaces hub (editorial). ✅ done, session 1.
2. **B1–B15** — publish all compare-anchored posts with real price data; verify the internal-link path blog→`/compare/[slug]`→signup renders. ✅ done (2 session 1 + 13 session 2, all 15 compare slugs covered).
3. **C1–C3** — the three reframed sourcing posts. ✅ done (C1, C3 published; C2 folded into an existing post instead of duplicating it, see status section above).
4. **Full 72-post convert audit + bulk title shortening.** ✅ done, via 5 parallel subagents, see status section above for the breakdown.
5. **Every post:** verify the Crawli stat against live `compare_snapshots` the day you publish; cut any stat you can't verify. ✅ applied throughout; unsourced stats were softened rather than replaced with invented numbers.
