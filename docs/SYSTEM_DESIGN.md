# Crawli — System Design Reference

> Generated from a full system design walkthrough session, 2026-05-21.
> Covers: architecture, search engine internals, data layer, auth, cost model, scaling, and optimization history.

---

## Table of Contents

1. [What Crawli Is](#1-what-crawli-is)
2. [Top-Level Architecture](#2-top-level-architecture)
3. [The Search Engine: Step-by-Step](#3-the-search-engine-step-by-step)
4. [Data Layer: Supabase Schema](#4-data-layer-supabase-schema)
5. [Auth + Profile Layer](#5-auth--profile-layer)
6. [Cost Map](#6-cost-map)
7. [Scaling Upgrade Map](#7-scaling-upgrade-map)
8. [How We Worked With Claude to Optimize](#8-how-we-worked-with-claude-to-optimize)

---

## 1. What Crawli Is

Crawli is a **resale price aggregator**. One search query fans out to up to 9 fashion resale platforms simultaneously, scrapes individual listing pages, extracts structured data (price, condition, image, sold status), and returns everything in a unified view with min/avg/max price stats.

### Operator model

Crawli is a **single-operator hosted service** — not multi-tenant SaaS (yet).

```
┌─────────────────────────────┐
│      The Operator (you)     │
│                             │
│  Holds all API keys in .env │
│  OPENAI_API_KEY             │
│  FIRECRAWL_API_KEY          │
│  SUPABASE_URL + KEY         │
└──────────────┬──────────────┘
               │ runs the service on
┌──────────────▼──────────────┐
│    VPS / Laptop (1 box)     │
│  Next.js     (port 3000)    │
│  Python sidecar (port 8000) │
└──────────────┬──────────────┘
               │ serves
┌──────────────▼──────────────┐
│       End Users             │
│  Sign in, search, save,     │
│  watch listings.            │
│  Never see API keys.        │
└─────────────────────────────┘
```

When a user triggers a search, it's your Firecrawl credits, your OpenAI tokens, and your Chromium instance doing the work. The entire cost model is operator-side.

### The three jobs the system does

```
JOB 1: SEARCH
User query → fan out to platforms → return listings
Hot path. Every search hits Firecrawl + Playwright + maybe OpenAI.
Almost all cost and latency live here.

JOB 2: USER DATA (Saves, Watchlist, Profile)
Heart a listing → stored in Supabase (snapshot).
Eye a listing → stored in Supabase; re-scraped on demand.
Cheap. Mostly Supabase reads/writes.

JOB 3: AUTH
Email/password + Google OAuth via Supabase Auth.
Free. Supabase handles it; we just protect routes.
```

### Two-process architecture

```
Port 3000                        Port 8000
─────────                        ─────────
Next.js (TypeScript)             Python sidecar (crawl4ai-service/)

Handles:                         Handles:
• Auth, sessions, routing        • Chromium browser (Playwright)
• API routes                     • Page rendering + extraction
• React UI                       • LLM calls (OpenAI via litellm)
• Firecrawl calls                • Response caching (in-memory)
• Supabase reads/writes          • Anti-bot evasion (stealth mode)
```

The Next.js server is the **orchestrator**. The Python sidecar is the **browser engine**. They communicate over HTTP on localhost.

---

## 2. Top-Level Architecture

### Full system map

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│  React 19 + Next.js App Router                                   │
│  SearchForm → SearchSection → ResultsDisplay → ListingCard       │
│  FilterPanel  SavesProvider  WatchlistProvider                   │
│  ProfileHeader  SavesTab  WatchlistTab                           │
└───────────┬──────────────────────────────────────────────────────┘
            │ HTTPS (streaming NDJSON for search; JSON for rest)
┌───────────▼──────────────────────────────────────────────────────┐
│                  NEXT.JS SERVER (port 3000)                       │
│                                                                  │
│  proxy.ts → refreshes Supabase session cookie on every request   │
│  app/(protected)/layout.tsx → server-side auth guard            │
│                                                                  │
│  POST /api/search          search orchestrator                   │
│  /api/saves/*              save/unsave listings                  │
│  /api/collection-folders/* organize saves into folders           │
│  /api/watchlist/*          watch/unwatch + refresh prices        │
│  /api/profile              update display_name/bio/avatar        │
│  /auth/callback            OAuth + password-reset handler        │
└───┬──────────────┬─────────────────────┬────────────────────────┘
    │              │                     │
    ▼              ▼                     ▼
┌────────┐  ┌──────────────┐  ┌─────────────────────────────────┐
│FIRE-   │  │  SUPABASE    │  │  PYTHON SIDECAR  (port 8000)    │
│CRAWL   │  │              │  │                                 │
│        │  │ Auth:        │  │  POST /scrape                   │
│search()│  │  auth.users  │  │  POST /scrape-search            │
│        │  │  email+pw    │  │  GET  /health                   │
│URL     │  │  Google OAuth│  │  POST /refresh-price            │
│discov- │  │              │  │                                 │
│ery only│  │ Tables:      │  │  TTLCache (in-memory)           │
│        │  │  profiles    │  │  Per-domain pacer               │
│4 cred  │  │  saves       │  │  Render semaphore               │
│/platf  │  │  coll_folders│  │  Chromium pool                  │
│/search │  │  watchlist   │  │  3-Tier extraction cascade      │
│        │  │              │  │                                 │
│~20 URLs│  │ Storage:     │  │  OpenAI gpt-4o-mini (fallback)  │
│returned│  │  avatars     │  │  via litellm                    │
└────────┘  └──────────────┘  └─────────────────────────────────┘
```

### The three request paths

```
PATH A — SEARCH (hot, expensive)
Browser → POST /api/search
       → Firecrawl (URL discovery, 4 credits × N platforms)
       → Python sidecar /scrape (per URL, Playwright + maybe LLM)
       → NDJSON stream back to browser
       → NO Supabase writes (results are ephemeral)

PATH B — SAVE / WATCHLIST (cheap, Supabase-only)
Browser → POST /api/saves or /api/watchlist
       → Supabase INSERT (snapshot of listing data)
       → NO sidecar, NO Firecrawl

PATH C — WATCHLIST REFRESH (medium cost, sidecar only)
Browser → POST /api/watchlist/refresh
       → Next.js worker pool (WATCHLIST_REFRESH_CONCURRENCY=4)
       → Python sidecar /refresh-price (per row)
         Tier 1: httpx GET (no Chromium) → done if succeeds
         Tier 2: Playwright → done if succeeds
         Tier 3: LLM (if structured misses)
       → Supabase UPDATE price_current + is_sold + last_checked_at
       → NDJSON progress stream back to browser
       → NO Firecrawl
```

### Dependency map

```
Next.js ──────────► Firecrawl        (search only; 4 credits/platform/search)
Next.js ──────────► Python sidecar   (HTTP localhost:8000)
Next.js ──────────► Supabase         (auth + DB + storage)
Browser ───────────► Supabase Storage (avatar uploads go direct)

Python sidecar ───► OpenAI           (gpt-4o-mini via litellm; LLM fallback only)
Python sidecar ───► target websites  (Playwright Chromium; stealth mode)

Supabase ─────────► itself           (trigger auto-creates profiles row on signup)
```

---

## 3. The Search Engine: Step-by-Step

### Step 0 — Query assembly (browser)

```
User types:  "fear of god essentials hoodie"
User picks:  Size: L, Color: black, Condition: Used, Category: Tops
             Platforms: [Grailed, Depop, Poshmark, StockX, ThredUp]
             Price: $50–$200  ← client-side only, NOT sent to API

filtersToQuerySuffix() appends filter keywords to query:

Final query sent to API:
"fear of god essentials hoodie black tops used size L"

Price filter is applied client-side after results return.
Everything else gets keyword-stuffed because platforms don't
expose uniform filter URL params.
```

### Step 1 — Fan-out with concurrency cap

```
POST /api/search arrives
      │
      ▼
Start NDJSON stream → browser (UI shows progress bars)
      │
      ▼
allSettledWithConcurrency(platforms, K=3)
K = SEARCH_PLATFORM_CONCURRENCY (default 3)

Example: 5 platforms, K=3

Round 1 (parallel):   [grailed]  [depop]  [poshmark]
Round 2 (as slots free): [stockx]  [thredup]

Each platform_done → emit event → UI snaps row to "Done — N results"
```

### Step 2 — Two pipelines depending on platform

```
                   platform selected
                          │
          ┌───────────────┴────────────────┐
          │                                │
   in SEARCH_PAGE_PLATFORMS?         normal platform?
   (currently: thredup)         (grailed, depop, poshmark,
          │                      stockx, mercari, vinted,
          │                      ebay, vestiaire)
          ▼                                ▼
   PATH A: Search-page            PATH B: Firecrawl
   extraction                     URL discovery
   (bypass Firecrawl)
```

**Path B — Firecrawl URL discovery (6 platforms):**

```
Firecrawl.search("site:grailed.com <query>")
      → returns ~20 candidate URLs
      → filterListingUrls() — per-platform regex keeps only listing pages
          grailed:   /listings/\d+/
          depop:     /products/\w+/
          stockx:    /products/\w+/
          poshmark:  /listing/\w+/
          mercari:   /item/\w+/
          vinted:    /items/\d+/
      → dedupe
      → ~8–12 clean listing URLs
      → scrape each (Step 3)

Cost: 4 Firecrawl credits per platform per search
```

**Path A — Search-page extraction (ThredUp):**

```
Build onsite URL: thredup.com/search/<hyphen-slug>
      → POST /scrape-search to sidecar
      → Render search results page (1 Chromium render)
      → extract_thredup_grid():
          reads JSON-LD Product array (119 items/page)
          merges with DOM href map (JSON-LD has no URL field)
          returns up to 100 ScrapedListing dicts
      → size post-filter (sizeFilter.ts)
      → up to 10 clean listings

Cost: 0 Firecrawl credits. 1 render. No LLM.
```

### Step 3 — Inside the sidecar (per listing URL)

```
POST /scrape {url, platform}
      │
      ├─► TTLCache check (30 min per URL)
      │       hit?  → return immediately (~9ms)
      │       miss? → continue
      │
      ├─► _driver_dead? (entire pool dead?)
      │       yes → 503 fast-fail
      │       no  → continue
      │
      ▼
_scheduled_render(platform, url):

  1. Per-domain pacer (B2)
     Wait until min interval has passed for this host:
       depop.com / grailed.com   → 400ms
       ebay.com / vestiaire.com  → 300ms
       others                   → 150ms
     Waits OUTSIDE the semaphore (no slot wasted)

  2. Acquire render semaphore (A1)
     asyncio.Semaphore(SIDECAR_MAX_CONCURRENT_RENDERS=6)
     7th render waits here until a slot frees

  3. Log in-flight line (B3)
     [scrape] platform=X url=… in_flight=N pool=K/M cache=miss

  4. Pick Chromium from pool (B1)
     Round-robin over alive pool members
     Default pool=1 → always pool[0]

  5. crawler.arun(url)
     headless=True, stealth=True, random UA
     wait_until="domcontentloaded"
     delay_before_return_html=5s (lets JS paint)
     up to 3 retries with increasing delay
     → raw HTML

3-Tier Extraction Cascade:

  TIER 1 — Structured extractor (per-platform, $0)
  ┌──────────────────────────────────────────────────┐
  │ PLATFORM_EXTRACTORS registry:                    │
  │                                                  │
  │ grailed/depop → JSON-LD Product block            │
  │   <script type="application/ld+json">            │
  │   {"@type":"Product","offers":{"price":"45.00"}} │
  │                                                  │
  │ stockx → data-testid="trade-box-buy-amount"      │
  │   missing + title present → price=null (no asks) │
  │   both missing → None → fall to Tier 2           │
  │                                                  │
  │ poshmark → og:title + og:image +                 │
  │            <p class="h1"><span>$N</span></p>     │
  │                                                  │
  │ mercari → __NEXT_DATA__.serverState[ItemDetail]  │
  │           price in CENTS → divide by 100         │
  │                                                  │
  │ vinted → regex on escaped RSC payload            │
  │          \"price\":{\"amount\":\"N\",...}         │
  │                                                  │
  │ ebay / vestiaire → NOT in registry               │
  │   → returns None → always falls to Tier 2        │
  │   (JSON-LD exists on those pages; extractor just │
  │    hasn't been written yet — C1 deferred work)   │
  └────────────────────┬─────────────────────────────┘
                       │ None
  TIER 2 — LLM fallback (~$0.001/listing)
  ┌──────────────────────────────────────────────────┐
  │ LLMExtractionStrategy via litellm → gpt-4o-mini  │
  │ Scopes markdown to target_elements (main product)│
  │ Drops "More from seller", "Similar items", footer│
  │ Platform-specific prompts:                       │
  │   stockx:   "Lowest Ask, not Last Sale"          │
  │   grailed:  "detect sold badge"                  │
  │   depop:    "discounted not strikethrough price" │
  │   poshmark: "ignore related listings"            │
  └────────────────────┬─────────────────────────────┘
                       │ no LLM key
  TIER 3 — Stub
  ┌──────────────────────────────────────────────────┐
  │ title only, price=null                           │
  └──────────────────────────────────────────────────┘

→ store in TTLCache → return ScrapedListing to Next.js
```

### Step 4 — Post-processing filter chain

```
ScrapedListing[] (raw from sidecar)
      │
      ├─ 1. Drop sold listings (isSold=true)
      │
      ├─ 2. Title relevance filter
      │      tokenize query + title, remove stopwords
      │      require ≥1 shared substantive token
      │      (catches cross-platform junk matches)
      │
      ├─ 3. Size filter (ALL platforms)
      │      check listing.size (structured field) first
      │      fall back to title regex
      │      matchRawSize() handles "L"/"Large"/"(US) L"/"L/XL"
      │
      ├─ 4. Color filter (white only, targeted)
      │      if color=white: drop "off-white" titles
      │      unless query itself says "off-white" (brand guard)
      │
      └─ 5. Map → Listing type + sort by price ascending
      │
      ▼
Emit platform_done → NDJSON stream → browser
After all done: emit final with min/max/avg stats
Browser: ResultsDisplay renders tabs + PriceSummary
Price range filter applied client-side
```

### Search timeline (end to end)

```
t=0s    User hits Search; NDJSON stream opens
t=0s    Round 1: Grailed + Depop + Poshmark enter Firecrawl
t=2s    Firecrawl returns URLs; sidecar starts rendering
t=8s    First platform_done (Depop: 8 results)
t=12s   Grailed, Poshmark done
t=12s   StockX + ThredUp enter (Round 2)
t=20s   ThredUp done (1 render, no LLM)
t=35s   StockX done (LLM fallback on most listings)
t=35s   final event → price summary → UI complete

Cache hits collapse any listing to ~9ms.
LLM-path platforms dominate tail latency.
```

---

## 4. Data Layer: Supabase Schema

```
auth.users  (Supabase-managed)
┌────────────────────────────────────┐
│ id       uuid  PK                  │
│ email    text                      │
│ password hashed (internal)         │
│ provider email | google            │
└──────────────┬─────────────────────┘
               │ ON INSERT → trigger → handle_new_user()
               ▼
public.profiles  (auto-created, one per user)
┌────────────────────────────────────┐
│ id           uuid  PK → auth.users │
│ email        text                  │
│ display_name text  nullable        │
│ avatar_url   text  nullable        │
│ bio          text  nullable        │
│ created_at   timestamptz           │
│ updated_at   timestamptz           │
└────────────────────────────────────┘
RLS: SELECT/UPDATE WHERE auth.uid() = id
No INSERT policy — trigger is SECURITY DEFINER

public.collection_folders
┌────────────────────────────────────┐
│ id          uuid  PK               │
│ user_id     uuid  → auth.users     │
│ name        text                   │
│ description text  nullable         │
│ is_default  bool  default false    │
│ created_at  timestamptz            │
└────────────────────────────────────┘
Constraint: UNIQUE (user_id) WHERE is_default = true
RLS: SELECT/INSERT/UPDATE/DELETE WHERE auth.uid() = user_id
Seed: ensureDefaultFolder() lazily creates "My Collection"

public.saves  (snapshot at save time)
┌────────────────────────────────────┐
│ id          uuid  PK               │
│ user_id     uuid  → auth.users     │
│ folder_id   uuid  → collection_folders ON DELETE SET NULL │
│ listing_url text  (natural key)    │
│ platform    text                   │
│ title       text                   │
│ price       numeric  nullable      │
│ currency    text  default 'USD'    │
│ condition   text  nullable         │
│ image_url   text  nullable         │
│ seller      text  nullable         │
│ saved_at    timestamptz            │
│ UNIQUE (user_id, listing_url)      │
└────────────────────────────────────┘
RLS: SELECT/INSERT/DELETE/PATCH WHERE auth.uid() = user_id
Index: (user_id, saved_at DESC), (user_id, platform)

Key decisions:
• listing.id (nanoid) NOT stored — ephemeral, not stable
• listing_url is the stable key for dedup + toggle
• price/image/title are snapshots — don't update
• folder_id=null after folder delete → still shows under My Collection
• My Collection GET applies no folder filter (shows everything)

public.watchlist  (live price tracking)
┌────────────────────────────────────┐
│ id              uuid  PK           │
│ user_id         uuid  → auth.users │
│ listing_url     text               │
│ platform        text               │
│ title           text               │
│ price_at_add    numeric nullable   │  ← never changes
│ price_current   numeric nullable   │  ← updated on refresh
│ currency        text  default 'USD'│
│ image_url       text  nullable     │
│ is_sold         bool  default false│
│ last_checked_at timestamptz        │
│ created_at      timestamptz        │
│ UNIQUE (user_id, listing_url)      │
└────────────────────────────────────┘
RLS: SELECT/INSERT/UPDATE/DELETE WHERE auth.uid() = user_id
Index: (user_id, created_at DESC)

Key decisions:
• price_at_add never changes → used for delta chip (▼ -$X / ▲ +$X)
• refresh failure → bump last_checked_at only, leave price/sold alone
• no auto-refresh — manual "Refresh prices" only (Phase 2D deferred)

Supabase Storage — avatars bucket
┌────────────────────────────────────┐
│ Bucket: avatars  (public)          │
│ Max: 2MB  Types: PNG/JPG/WebP      │
│ Path: {user_id}/avatar-{ts}.{ext}  │
└────────────────────────────────────┘
RLS: SELECT public; INSERT/UPDATE/DELETE scoped to own folder
```

### Critical permissions gotcha

```
RLS policy alone is NOT enough.

Also required:
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.<table>
  TO authenticated;

Without this → Postgres returns 42501 "permission denied"
even if the RLS policy says access is allowed.
This burned us on saves, watchlist, and profiles.
```

### Saves vs Watchlist

```
saved=true,  watched=false  → snapshot stored, no price tracking
saved=false, watched=true   → price tracked, not in collection
saved=true,  watched=true   → both (independent, not flags)
saved=false, watched=false  → nothing stored

Heart icon → saves table
Eye icon   → watchlist table
No coupling between the two.
```

---

## 5. Auth + Profile Layer

### Sign-up / sign-in flows

```
EMAIL/PASSWORD SIGN-UP
User fills form → supabase.auth.signUp()
→ Supabase sends confirmation email
→ User clicks link → /auth/callback?code=...
→ callback exchanges code for session cookie
→ DB trigger fires: INSERT INTO public.profiles
→ redirect to /

GOOGLE OAUTH
User clicks "Continue with Google"
→ supabase.auth.signInWithOAuth()
→ Google consent → Supabase callback
→ /auth/callback exchanges code → session cookie
→ same trigger fires → profiles row created
→ redirect to /

PASSWORD RESET
/forgot-password → resetPasswordForEmail()
→ email → user clicks link
→ /auth/reset-password → updateUser({password})
→ redirect to /
```

### Session cookie refresh

```
Every request hits proxy.ts first (Next 16 convention):

Browser request
     │
     ▼
proxy.ts
     │  supabase.auth.getUser() — refreshes cookie if expiring
     ▼
route handler sees fresh, valid session
```

### Route protection

```
app/(protected)/layout.tsx (server component)
     │
     ├─ auth.getUser()
     │    no session → redirect to /login
     │    session    → render children
     │
     └─ mounts for entire protected subtree:
          <SavesProvider>
            <WatchlistProvider>
              <Toaster />
              {children}
            </WatchlistProvider>
          </SavesProvider>
```

### Profile editing

```
EditProfileModal:
  Avatar  → browser uploads DIRECTLY to Supabase Storage
             path: {user_id}/avatar-{timestamp}.ext
  Name/bio → PATCH /api/profile (name ≤60 chars, bio ≤300 chars)
  router.refresh() → server re-fetches profiles row → re-renders
```

---

## 6. Cost Map

### Per-search cost breakdown

```
Scenario: 6 platforms, 10 listings/platform returned

FIRECRAWL (URL discovery)
6 platforms × 4 credits = 24 credits/search

Tier             Credits/mo    Cost/search
Free             1,400         $0 (~58 searches/mo cap)
Hobby ($20/mo)   5,000         $0.096
Standard($83/mo) 100,000       $0.020

OPENAI (LLM fallback — Tier 2 only)
Tier 1 platforms (Grailed, Depop, Poshmark, Mercari,
  Vinted, StockX, ThredUp):    $0/listing
Tier 2 platforms (eBay, Vestiaire):
  10 listings × ~$0.001        = $0.010/search

TOTAL PER SEARCH
                 Free      Hobby     Standard
Firecrawl:       $0        $0.096    $0.020
OpenAI LLM:      $0.010    $0.010    $0.010
Infra:           $0        ~$0       ~$0
                 ──────    ──────    ──────
Total:           $0.010    $0.106    $0.030
```

### Cost by platform

```
Platform      Tier 1 extractor?    LLM fires?    $/listing
──────────────────────────────────────────────────────────
Grailed       ✅ JSON-LD           Never         $0
Depop         ✅ JSON-LD           Never         $0
Poshmark      ✅ og+DOM            Never         $0
Mercari       ✅ __NEXT_DATA__     Never         $0
Vinted        ✅ RSC regex         Never         $0
StockX        ✅ testid            Rarely        ~$0
ThredUp       ✅ JSON-LD grid      Never         $0
eBay          ❌ not built yet     Always        ~$0.001
Vestiaire     ❌ not built yet     Always        ~$0.001
RealReal      gated/disabled       N/A           $0
```

eBay and Vestiaire go through the SAME Firecrawl → Playwright pipeline as all other platforms. The only difference is `PLATFORM_EXTRACTORS` doesn't have entries for them yet — so they fall straight to the LLM. The HTML and JSON-LD are already there on the page. This is the C1 deferred work (~1 day to fix).

### Cache impact

```
/scrape:        TTLCache 30 min per URL
/scrape-search: TTLCache 10 min per platform::query

Cache hit: ~9ms vs ~9s (1000× faster), $0 LLM cost
Cache miss: full render + possible LLM call

Firecrawl URL discovery is NOT cached — always runs.
Only scrape results are cached.
Failures never cached — transient blocks always retry.
```

### Cost for non-search features

```
Saves:             Supabase INSERT → $0
Watchlist refresh: No Firecrawl; Tier 1 httpx first ($0);
                   Playwright if needed (infra only);
                   LLM only if structured misses (~$0.001/item)
Auth:              Supabase free tier → $0 (50k MAU)
Storage:           Free tier: 5GB → $0 until meaningful scale
```

### Monthly cost at scale

```
                Solo      Small     Medium    Large
Searches/mo     ~50       ~1,000    ~10,000   ~80,000
─────────────────────────────────────────────────────
Infrastructure  $0        $20-30    $40-80    $200-400
Firecrawl       $0 (free) $0-20     $20       $83
OpenAI          ~$0.10    ~$2-5     ~$10-25   ~$80-200
Supabase        $0        $0        $0        $25 (Pro)
─────────────────────────────────────────────────────
Total           ~$0       ~$22-55   ~$70-125  ~$388-708
$/search        ~$0.002   ~$0.03    ~$0.009   ~$0.006
```

Cost per search drops at scale — cache hit rate rises and Standard tier is 8× cheaper per credit than Hobby.

### Highest-ROI optimization available right now

```
C1 — eBay + Vestiaire structured extractors
  Both sites have Schema.org JSON-LD on every listing page.
  Add extract_ebay() + extract_vestiaire() to PLATFORM_EXTRACTORS.
  ~1 day of work.

At 10,000 searches/mo:
  $0.001 × 10 listings × 2 platforms × 10,000 searches
  = $200/mo eliminated
  Exceeds infrastructure cost at Medium tier.
```

---

## 7. Scaling Upgrade Map

### Where things break

```
NEXT.JS
  ⚠️ Firecrawl free tier exhausted at ~58 searches/mo
     Fix: upgrade to Hobby ($20) or Standard ($83)
     Trigger: credits exhausted OR discovery wait >20% of latency

  ⚠️ Single Node.js process under heavy concurrent API load
     Fix: PM2 cluster mode or multi-core VPS (no code changes)
     Trigger: CPU >80% sustained on Next.js process

PYTHON SIDECAR
  ⚠️ TTLCache is per-process
     With 2 sidecar instances, each has a cold cache
     Fix (C2): Redis-backed shared cache
     Trigger: when deploying multiple sidecar instances

  ⚠️ Per-domain pacer is per-process
     2 instances = 2 independent pacers = half the gap = anti-bot risk
     Fix (C2): Redis-backed distributed rate limiter
     Trigger: same as above

  ⚠️ Render semaphore ceiling vs RAM
     6 renders × 300MB = 1.8GB for renders alone on a 4GB VPS
     Fix: tune SIDECAR_MAX_CONCURRENT_RENDERS to available RAM
     Trigger: OOM kills or swap thrashing

  ⚠️ Single Chromium process CPU ceiling at ~6-8 concurrent renders
     Fix: SIDECAR_BROWSER_POOL_SIZE=2 on 8GB box
     Trigger: CPU >80% sustained during searches

  ⚠️ eBay + Vestiaire always hit LLM (C1 deferred)
     Fix: write extract_ebay() + extract_vestiaire()
     Trigger: any — pure win, earlier is better

  ⚠️ Single sidecar instance horizontal scaling wall (C2)
     Fix: Redis job queue + N sidecar workers
     Trigger: CPU >90% sustained, p95 >30s, one box saturated

EXTERNAL PLATFORMS
  ⚠️ Anti-bot detection at volume (C4)
     Fix: paid unlocker (ScrapingBee/ZenRows/Bright Data)
          local attempt first → unlocker on failure only
     Trigger: per-platform success rate <70% sustained
              AFTER C1 + pacing tuning already applied
```

### 5-tier upgrade ladder

```
TIER        TRIGGER                   WHAT TO DO
──────────────────────────────────────────────────────────────
Solo        Today. Default settings.  Ship C1 (pure win).
            ~58 searches/mo free.     No other changes needed.

Small       Credits exhausted or      Upgrade Firecrawl → Hobby.
            >10 concurrent users.     RENDERS=8, PLATFORM_CONC=4.
                                      Systemd + nginx + certbot.
                                      No code changes.

Medium      CPU >80% or p95 >20s.    POOL_SIZE=2, RENDERS=12,
                                      PLATFORM_CONC=5.
                                      Firecrawl → Standard ($83).
                                      JSON logs → aggregator.
                                      No architecture change.

Large       One box provably          C2: Redis job queue.
            saturated.                Refactor Next.js + sidecar.
            CPU >90% sustained.       Replace in-process cache+pacer
                                      with Redis-backed versions.
                                      Only tier needing real code changes.

Enterprise  Anti-bot rising at        C4: paid unlocker for worst
            volume.                   offenders only.
                                      CDN, multi-region, SRE.
```

### Deferred PRs — what they touch

```
C1 — eBay + Vestiaire structured extractors
  File: crawl4ai-service/structured_extractors.py
  Add: extract_ebay(), extract_vestiaire()
  Add: "ebay", "vestiaire" to PLATFORM_EXTRACTORS
  Impact: eliminates LLM for both; ~$200/mo saved at Medium tier

C2 — Multi-instance sidecar
  Files: app/api/search/route.ts (write jobs to Redis)
         crawl4ai-service/main.py (poll Redis for jobs)
         new: Redis instance
  Also: in-process cache → Redis; per-process pacer → Redis
  Impact: breaks the single-box ceiling

C3 — Firecrawl paid plan
  Files: none — zero code changes
  Action: upgrade plan, bump SEARCH_PLATFORM_CONCURRENCY=5

C4 — Paid anti-bot unlocker
  File: crawl4ai-service/main.py
  Add: fallback HTTP path for problem platforms
       local attempt first → unlocker on failure
```

### Bottleneck progression

```
Users:    1─────10─────100──────500──────3000+
               │       │        │         │
               │       │        │         └── C4 anti-bot unlocker
               │       │        └── C2 multi-instance + Redis
               │       └── C1 extractors + pool=2 + Firecrawl paid
               └── Ship C1 now (pure win at any scale)

Cost:    $0────$25────$100─────$400─────$1000+
                          │
                          └── C1 bends this curve down sharply
```

---

## 8. How We Worked With Claude to Optimize

### Chapter 1 — Wrong prices (the LLM hallucination problem)

**Problem:** Depop listing at $45 → Crawli returned $39.55. StockX showing no asks → hallucinated price. Mercari prices off 2-3×.

**Root cause:** LLM reading entire rendered page as markdown, including "More from seller" rails, "Similar items", shipping prices, Last Sale figures. With 5-10 prices on a page, the LLM reliably picked the wrong one.

**Diagnosis:** Built `debug_probe.py` to dump raw HTML, JSON-LD, og: tags, and `__NEXT_DATA__` for any URL. Ran against known-wrong listings.

**What was built:** `structured_extractors.py` — per-platform deterministic parsers reading structured data directly. The 3-tier cascade (structured → LLM → stub).

**Result:** Before: every platform → LLM → wrong prices ~30% of the time. After: 7 platforms → structured → correct prices ~99%. LLM only fires for eBay + Vestiaire + edge cases.

---

### Chapter 2 — ThredUp: URL discovery gap

**Problem:** `site:thredup.com` Firecrawl search returned zero individual listing URLs — only category pages.

**Key insight:** ThredUp's search results page already contains all needed data (price, title, image, condition) in a single JSON-LD blob (119 Product objects per render). No individual listing URLs needed.

**What was built:** `search_page_extractors.py` + `POST /scrape-search` endpoint. Route branches at the top: if `platform in SEARCH_PAGE_PLATFORMS` → one render of the search page; else → Firecrawl → per-URL scrapes.

**Result:** ThredUp as 9th platform, 0 Firecrawl credits, 1 render per search. Pattern reusable for any platform whose listing URLs aren't indexable.

---

### Chapter 3 — The concurrency crash

**Problem:** Full 8-platform search → 16+ concurrent Playwright renders → Playwright Node driver subprocess died → every subsequent scrape returned null forever until manual restart.

**Root cause:** `Promise.all(platforms.map(...))` with no concurrency cap. No detection, no restart, no circuit breaker.

**What was built (3 PRs):**

- **PR 1:** `asyncio.Semaphore(6)` gates every `arun()` call. Driver-death detection + auto-restart (~2.3s). `allSettledWithConcurrency(K=3)` in Next.js. TTLCache (30min/URL, 10min/query).
- **PR 2:** `_crawler_pool[]` replaces single crawler (env-tunable pool size). Per-domain pacing dict (min gap per host, outside semaphore). `_scheduled_render()` context manager. `/health` reports pool state.
- **PR 3:** Watchlist refresh gets same protections. Tier 1 httpx semaphore. `WATCHLIST_REFRESH_CONCURRENCY` env var.

**Result:** Before: 8-platform search → driver death in 30s → 0 results. After: 62 listings, all platforms ok, no driver death. Cache: 9.1s → 9ms on repeat. Recovery: driver kill → back in 2.3s.

---

### Chapter 4 — Size filter inaccuracy

**Problem:** Searching Grailed with Size L → Medium hoodie returned. ThredUp "large" → XL / 2XL results.

**Root cause:** (1) Size post-filter only applied in ThredUp branch — Firecrawl path skipped it entirely. (2) `matchListingSize()` only checked title text; Grailed titles don't embed size.

**What was built:** `_extract_size_from_product()` reads `product.size` or `additionalProperty[]`. `size` field threaded through `LISTING_SCHEMA`, `ScrapedListing`, `Listing`. `matchRawSize()` for direct value matching. Size filter applied in both route branches.

**Result:** Size filtering works across all platforms. Structured field checked first; title regex as fallback. Firecrawl path (6 platforms) now actually filters by size.

---

### Chapter 5 — The engine bake-off

**Question:** Should we switch from crawl4ai to Firecrawl for scraping?

**Test:** `engine_bakeoff.py` — 72 URLs × 2 engines × 3 queries.

```
                crawl4ai        Firecrawl basic
Accuracy        94% (34/36)     83% (30/36)
p50 latency     11,226ms        3,205ms
p95 latency     90,047ms        6,134ms
Cost/72 URLs    $0.098 OAI      $0.288 Hobby
```

**Decision:** Stay on crawl4ai. Accuracy advantage outweighs speed gap. Firecrawl stays for URL discovery only. Limit bumped 5 → 10 results per platform (1.83× more listings for 2.2× cost).

---

### How to keep working with Claude effectively

```
WHAT WORKS
──────────────────────────────────────────────────────────
1. Observe a specific wrong output, not a vague feeling
   "Depop returned $39.55 but listing shows $45"
   Not: "prices seem off sometimes"

2. Diagnose before building
   Build a probe script first. Never assume what's in the HTML.
   Check before writing any extractor.

3. One problem, one PR
   Each PR had a single clear purpose, independently verifiable.

4. Gate unfinished work behind env vars
   REALREAL_ENABLED=1 — broken platforms don't affect users.

5. HANDOFF.md as the contract between sessions
   Full sync at end of every session — what worked, what failed,
   what's still broken. Next session reads it before touching anything.

6. Deferred work is specs, not TODOs
   C1/C2/C3/C4 have trigger conditions. You know exactly when to act.

NEXT STEPS IN PRIORITY ORDER
──────────────────────────────────────────────────────────
1. C1 — eBay + Vestiaire structured extractors
   ~1 day. ~$200/mo saved at Medium tier. Highest ROI.

2. Background searches + notification
   Design fully spec'd in HANDOFF.md.
   search_jobs table → Supabase Realtime → in-app toast.
   ~1.5 days for smallest viable cut.

3. Price alerts (Phase 2D)
   Auto-refresh watchlist + email on price drop.
   Needs pg_cron or Supabase Edge Function + Resend/SendGrid.

4. RealReal re-enable
   Extractor + dispatch already written, gated behind env var.
   Blocker: PerimeterX. Re-enable checklist in HANDOFF.md.
```

---

### Optimization timeline

```
May 15  Wrong prices         → 3-tier structured extractor cascade
                                $0/listing for 7/9 platforms

May 15  UI was blocking      → NDJSON streaming
                                results arrive progressively

May 18  ThredUp blocked      → search-page extraction pattern
                                0 Firecrawl credits, 1 render

May 18  Auth + user data     → Supabase Auth + saves + watchlist
                                + collection folders + profile

May 19  "Switch scrapers?"   → engine bake-off (72 URLs × 2 engines)
                                stayed on crawl4ai, limit 5 → 10

May 19  RealReal attempted   → PerimeterX defeated UndetectedAdapter
                                gated, extractor ready for re-enable

May 20  Driver death crash   → semaphore + pool + pacing (3 PRs)
                                self-healing under load

May 20  Size filter gaps     → structured size field through pipeline
                                all platforms now filter correctly
```
