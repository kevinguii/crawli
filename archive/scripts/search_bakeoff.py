#!/usr/bin/env python3
"""URL-discovery bake-off: Firecrawl search vs Serper search.

Same query, same `site:<domain>` operator, same limit. Counts how many
*listing-shape* URLs each provider returns after the same regex filter
that production uses (lib/parse.ts → LISTING_URL_PATTERNS).

Usage:
    python scripts/search_bakeoff.py

Outputs:
    scripts/search_bakeoff_results.csv  — one row per (query, platform, provider)
    Markdown summary table printed to stdout.

Reads env vars:
    FIRECRAWL_API_KEY  — required
    SERPER_API_KEY     — required

Pricing (kept in sync with docs/FIRECRAWL_PRICING.md and Serper public pricing):
    Firecrawl: 2 credits per 10 results → limit=20 = 4 credits/call
               Hobby:    $0.004/credit  → $0.016/call
               Standard: $0.00099/credit → $0.00396/call
    Serper:    $0.30–$1.00 per 1K queries (1 query/call regardless of num)
               Starter: $0.001/call  Ultimate: $0.0003/call
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Optional

import httpx

ROOT = Path(__file__).resolve().parents[1]
RESULTS_PATH = ROOT / "scripts" / "search_bakeoff_results.csv"

# Load .env from project root if python-dotenv is available. Optional — env
# vars passed inline still work, this is just a convenience for local dev.
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

# Small default set — quick smoke run.
QUERIES_SMALL = ["gucci bag", "nike air jordan 1", "levis 501 jeans"]

# Big set — 20 diverse fashion-resale queries spanning luxury bags, sneakers
# (iconic + trending), denim, workwear, outdoor, streetwear, basics, designer.
# Used when --big is passed. Picked to mirror real Crawli traffic mix.
QUERIES_BIG = [
    # Luxury bags
    "gucci marmont bag",
    "louis vuitton neverfull",
    "chanel flap bag",
    # Sneakers — mix iconic + trending
    "nike air force 1",
    "jordan 4",
    "adidas samba",
    "yeezy 350",
    "new balance 990",
    # Denim / workwear
    "levis 501",
    "carhartt double knee",
    # Outdoor
    "north face nuptse",
    "patagonia fleece",
    # Streetwear
    "stussy hoodie",
    "supreme tee",
    # Preppy / basics
    "polo ralph lauren rugby",
    "uniqlo down jacket",
    "champion reverse weave",
    # Vintage qualifier
    "vintage denim jacket",
    # Designer
    "rick owens",
    "comme des garcons play",
]

# 8 Firecrawl-search platforms (ThredUp/RealReal use the sidecar's /scrape-search instead).
PLATFORMS = [
    "grailed", "depop", "poshmark", "mercari",
    "vinted", "stockx", "ebay", "vestiaire",
]

PLATFORM_DOMAINS = {
    "grailed": "grailed.com",
    "depop": "depop.com",
    "poshmark": "poshmark.com",
    "mercari": "mercari.com",
    "vinted": "vinted.com",
    "stockx": "stockx.com",
    "ebay": "ebay.com",
    "vestiaire": "vestiairecollective.com",
}

SEARCH_LIMIT = 20

# Mirror of lib/parse.ts LISTING_URL_PATTERNS. Keep in sync.
LISTING_URL_PATTERNS: dict[str, re.Pattern[str]] = {
    "grailed": re.compile(r"grailed\.com/listings/"),
    "depop": re.compile(r"depop\.com/products/"),
    "stockx": re.compile(
        r"^https?://(?:www\.)?stockx\.com/[a-z0-9][a-z0-9-]+[a-z0-9](?:\?[^/]*)?$",
        re.IGNORECASE,
    ),
    "vestiaire": re.compile(r"vestiairecollective\.com/.*\d{5,}"),
    "vinted": re.compile(r"vinted\.com/items/\d+"),
    "mercari": re.compile(r"mercari\.com/us/item/"),
    "poshmark": re.compile(r"poshmark\.com/listing/"),
    "ebay": re.compile(r"ebay\.com/itm/"),
}

# Pricing — keep in sync with docs/FIRECRAWL_PRICING.md.
FIRECRAWL_CREDITS_PER_CALL = 2 * ((SEARCH_LIMIT + 9) // 10)  # limit=20 → 4 credits
FIRECRAWL_PRICE_HOBBY = 20 / 5000                             # $0.004/credit
FIRECRAWL_PRICE_STANDARD = 99 / 100_000                       # $0.00099/credit
FIRECRAWL_COST_HOBBY = FIRECRAWL_CREDITS_PER_CALL * FIRECRAWL_PRICE_HOBBY
FIRECRAWL_COST_STANDARD = FIRECRAWL_CREDITS_PER_CALL * FIRECRAWL_PRICE_STANDARD

# Serper: 1 query per call regardless of num. Public tiers as of 2026-05.
SERPER_COST_STARTER = 0.001    # $50/mo → 50K queries
SERPER_COST_ULTIMATE = 0.0003  # high-volume tier

# Brave: $3-$5 per 1K queries (web endpoint). Free tier is metered $5 credit/mo.
BRAVE_COST_PER_CALL = 0.003


@dataclass
class Attempt:
    query: str
    platform: str
    provider: str
    total_urls: int = 0
    listing_urls: int = 0
    unique_listing_urls: int = 0
    wallclock_ms: int = 0
    cost_usd: float = 0.0
    error: str = ""
    sample_urls: list[str] = field(default_factory=list)  # first 3 listing URLs


# ── Provider: Firecrawl ────────────────────────────────────────────────────

def search_firecrawl(platform: str, query: str) -> Attempt:
    a = Attempt(query=query, platform=platform, provider="firecrawl")
    a.cost_usd = FIRECRAWL_COST_HOBBY
    domain = PLATFORM_DOMAINS[platform]
    site_query = f"site:{domain} {query}"

    t0 = time.monotonic()
    try:
        api_key = os.environ["FIRECRAWL_API_KEY"]
        from firecrawl import Firecrawl
        fc = Firecrawl(api_key=api_key)
        resp = fc.search(query=site_query, limit=SEARCH_LIMIT)
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)

        web = getattr(resp, "web", None) or []
        urls: list[str] = []
        for item in web:
            u = getattr(item, "url", None) or (item.get("url") if isinstance(item, dict) else None)
            if u:
                urls.append(u)
        _record(a, urls)
    except KeyError:
        a.error = "FIRECRAWL_API_KEY not set"
    except Exception as e:  # noqa: BLE001
        a.error = f"{type(e).__name__}: {str(e)[:160]}"
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
    return a


# ── Provider: Serper ───────────────────────────────────────────────────────
#
# Free tier blocks `site:` operator with HTTP 400. We test three query
# variants so we can see whether the cheaper non-site: forms still return
# enough listing-shape URLs to be useful:
#
#   serper-site      "site:depop.com gucci bag"   (only works on paid plan)
#   serper-domain    "gucci bag depop.com"        (free-tier-safe)
#   serper-word      "gucci bag depop"            (free-tier-safe, looser)
#
# All three then run through the same LISTING_URL_PATTERNS filter — so the
# comparison is "after filtering for real listings, how many do you get?"

def _serper_call(query_str: str, platform: str, provider_label: str) -> Attempt:
    a = Attempt(query=query_str, platform=platform, provider=provider_label)
    a.cost_usd = SERPER_COST_STARTER
    t0 = time.monotonic()
    try:
        api_key = os.environ["SERPER_API_KEY"]
        resp = httpx.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query_str, "num": SEARCH_LIMIT},
            timeout=30,
        )
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
        if resp.status_code != 200:
            a.error = f"HTTP {resp.status_code}: {resp.text[:160]}"
            return a
        data = resp.json()
        organic = data.get("organic") or []
        urls = [item["link"] for item in organic if item.get("link")]
        _record(a, urls)
    except KeyError:
        a.error = "SERPER_API_KEY not set"
    except Exception as e:  # noqa: BLE001
        a.error = f"{type(e).__name__}: {str(e)[:160]}"
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
    return a


def search_serper_site(platform: str, query: str) -> Attempt:
    domain = PLATFORM_DOMAINS[platform]
    a = _serper_call(f"site:{domain} {query}", platform, "serper-site")
    a.query = query  # store original for cross-provider grouping
    return a


def search_serper_domain(platform: str, query: str) -> Attempt:
    """Append the full domain as a search term (no operator)."""
    domain = PLATFORM_DOMAINS[platform]
    a = _serper_call(f"{query} {domain}", platform, "serper-domain")
    a.query = query
    return a


def search_serper_word(platform: str, query: str) -> Attempt:
    """Append the platform name (domain without TLD) as a search term."""
    domain_word = PLATFORM_DOMAINS[platform].split(".")[0]
    a = _serper_call(f"{query} {domain_word}", platform, "serper-word")
    a.query = query
    return a


# ── Provider: Brave Search API ─────────────────────────────────────────────
#
# Brave's docs state `site:` is supported on every tier. Free tier (new
# scheme) is $5 prepaid credit/mo. Endpoint returns web.results[].

def search_brave(platform: str, query: str) -> Attempt:
    a = Attempt(query=query, platform=platform, provider="brave")
    a.cost_usd = BRAVE_COST_PER_CALL
    domain = PLATFORM_DOMAINS[platform]
    site_query = f"site:{domain} {query}"

    t0 = time.monotonic()
    try:
        api_key = os.environ["BRAVE_API_KEY"]
        resp = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={
                "X-Subscription-Token": api_key,
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
            },
            params={"q": site_query, "count": SEARCH_LIMIT},
            timeout=30,
        )
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
        if resp.status_code != 200:
            a.error = f"HTTP {resp.status_code}: {resp.text[:160]}"
            return a
        data = resp.json()
        web = (data.get("web") or {}).get("results") or []
        urls = [item["url"] for item in web if item.get("url")]
        _record(a, urls)
    except KeyError:
        a.error = "BRAVE_API_KEY not set"
    except Exception as e:  # noqa: BLE001
        a.error = f"{type(e).__name__}: {str(e)[:160]}"
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
    return a


# ── Shared: filter to listing-shape URLs ───────────────────────────────────

def _record(a: Attempt, urls: list[str]) -> None:
    a.total_urls = len(urls)
    pattern = LISTING_URL_PATTERNS.get(a.platform)
    if pattern is None:
        listings = urls
    else:
        listings = [u for u in urls if pattern.search(u)]
    a.listing_urls = len(listings)
    a.unique_listing_urls = len(set(listings))
    a.sample_urls = list(dict.fromkeys(listings))[:3]


# ── Runner ─────────────────────────────────────────────────────────────────

SMALL_PROVIDERS = (search_firecrawl, search_serper_site, search_serper_domain, search_serper_word, search_brave)
BIG_PROVIDERS = (search_firecrawl, search_brave)  # only the two viable candidates


def run(queries: list[str], providers: tuple) -> list[Attempt]:
    rows: list[Attempt] = []
    for query in queries:
        for platform in PLATFORMS:
            print(f"\n=== {query!r} / {platform} ===", flush=True)
            for fn in providers:
                a = fn(platform, query)
                rows.append(a)
                if a.error:
                    print(f"  [{a.provider:14}] ERROR: {a.error[:90]}")
                else:
                    print(
                        f"  [{a.provider:14}] total={a.total_urls:>2}  "
                        f"listings={a.listing_urls:>2}  unique={a.unique_listing_urls:>2}  "
                        f"{a.wallclock_ms:>5}ms"
                    )
    return rows


# ── Output ─────────────────────────────────────────────────────────────────

def write_csv(rows: list[Attempt]) -> None:
    if not rows:
        return
    sample_cols = ["sample_1", "sample_2", "sample_3"]
    base_cols = [k for k in rows[0].__dict__.keys() if k != "sample_urls"]
    cols = base_cols + sample_cols
    with open(RESULTS_PATH, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            d = asdict(r)
            samples = d.pop("sample_urls", [])
            for i, col in enumerate(sample_cols):
                d[col] = samples[i] if i < len(samples) else ""
            w.writerow(d)
    print(f"\nWrote {RESULTS_PATH} ({len(rows)} rows)")


def print_summary(rows: list[Attempt], queries: list[str]) -> None:
    by_provider: dict[str, list[Attempt]] = {}
    for r in rows:
        by_provider.setdefault(r.provider, []).append(r)

    print("\n## Overall")
    print("| Provider | Calls | Errors | Total URLs | Listing URLs | Unique Listings | p50 ms | p95 ms | $ total (one run) |")
    print("|---|---|---|---|---|---|---|---|---|")
    for provider, lst in by_provider.items():
        n = len(lst)
        errors = sum(1 for r in lst if r.error)
        total = sum(r.total_urls for r in lst)
        listings = sum(r.listing_urls for r in lst)
        unique = sum(r.unique_listing_urls for r in lst)
        times = sorted(r.wallclock_ms for r in lst if not r.error)
        p50 = times[len(times) // 2] if times else 0
        p95 = times[min(len(times) - 1, int(len(times) * 0.95))] if times else 0
        total_cost = sum(r.cost_usd for r in lst if not r.error)
        print(
            f"| {provider} | {n} | {errors} | {total} | {listings} | {unique} | "
            f"{p50} | {p95} | ${total_cost:.4f} |"
        )

    all_known_providers = ["firecrawl", "serper-site", "serper-domain", "serper-word", "brave"]
    providers_in_order = [p for p in all_known_providers if p in by_provider]

    def _listing_count(provider: str, platform: str) -> int:
        return sum(r.listing_urls for r in rows
                   if r.provider == provider and r.platform == platform and not r.error)

    # Per-platform listing-URL counts side by side, with delta vs Firecrawl baseline.
    print("\n## Listing URLs per platform (sum across all queries)")
    header = "| Platform | " + " | ".join(providers_in_order) + " |"
    sep = "|" + "|".join(["---"] * (len(providers_in_order) + 1)) + "|"
    print(header)
    print(sep)
    for platform in PLATFORMS:
        cells = [str(_listing_count(p, platform)) for p in providers_in_order]
        print(f"| {platform} | " + " | ".join(cells) + " |")

    other_providers = [p for p in providers_in_order if p != "firecrawl"]
    print("\n## Δ vs Firecrawl baseline (per platform, sum across queries)")
    print("| Platform | " + " | ".join(other_providers) + " |")
    print("|" + "|".join(["---"] * (len(other_providers) + 1)) + "|")
    for platform in PLATFORMS:
        fc = _listing_count("firecrawl", platform)
        deltas = []
        for p in other_providers:
            d = _listing_count(p, platform) - fc
            marker = "✅" if d >= 0 else "⚠️"
            deltas.append(f"{d:+d} {marker}")
        print(f"| {platform} | " + " | ".join(deltas) + " |")

    # Per-query, per-platform for the eyeball check.
    print("\n## Per-query, per-platform listing counts")
    print("| Query | Platform | " + " | ".join(providers_in_order) + " |")
    print("|" + "|".join(["---"] * (len(providers_in_order) + 2)) + "|")
    for query in queries:
        for platform in PLATFORMS:
            cells: list[str] = []
            for prov in providers_in_order:
                row = next((r for r in rows if r.provider == prov and r.query == query and r.platform == platform), None)
                if row is None:
                    cells.append("-")
                elif row.error:
                    cells.append("ERR")
                else:
                    cells.append(str(row.listing_urls))
            print(f"| {query} | {platform} | " + " | ".join(cells) + " |")

    # Cost projection.
    fc_total_cost_per_search = FIRECRAWL_COST_HOBBY * len(PLATFORMS)
    sr_total_cost_per_search = SERPER_COST_STARTER * len(PLATFORMS)
    brave_total_cost_per_search = BRAVE_COST_PER_CALL * len(PLATFORMS)
    print("\n## Cost projection (per full user search, 8 platforms)")
    print(f"- Firecrawl Hobby:     ${fc_total_cost_per_search:.4f}")
    print(f"- Firecrawl Standard:  ${FIRECRAWL_COST_STANDARD * len(PLATFORMS):.4f}")
    print(f"- Serper Starter:      ${sr_total_cost_per_search:.4f}  "
          f"({fc_total_cost_per_search / sr_total_cost_per_search:.1f}× cheaper than Hobby)")
    print(f"- Serper Ultimate:     ${SERPER_COST_ULTIMATE * len(PLATFORMS):.4f}")
    print(f"- Brave (web):         ${brave_total_cost_per_search:.4f}  "
          f"({fc_total_cost_per_search / brave_total_cost_per_search:.1f}× cheaper than Hobby)")

    # ── Brave-first / Firecrawl-fallback hybrid analysis ──────────────────
    if "brave" in by_provider and "firecrawl" in by_provider:
        print("\n## Hybrid analysis: Brave-first, Firecrawl-fallback when Brave < N")
        print("\nPer-platform: % of queries where Brave hit the threshold (and would skip the fallback).")
        print("Higher = Brave more reliable on this platform = less fallback firing.")
        thresholds = [1, 3, 5, 8]
        header = "| Platform | " + " | ".join(f"≥{n}" for n in thresholds) + " | mean Brave | mean Firecrawl |"
        sep = "|" + "|".join(["---"] * (len(thresholds) + 3)) + "|"
        print(header)
        print(sep)
        n_queries = len(queries)
        for platform in PLATFORMS:
            brave_rows = [r for r in rows if r.provider == "brave" and r.platform == platform and not r.error]
            fc_rows = [r for r in rows if r.provider == "firecrawl" and r.platform == platform and not r.error]
            if not brave_rows or not fc_rows:
                continue
            counts = [r.listing_urls for r in brave_rows]
            pct_cells = []
            for n in thresholds:
                hits = sum(1 for c in counts if c >= n)
                pct = 100 * hits / n_queries
                pct_cells.append(f"{pct:.0f}%")
            mean_brave = sum(counts) / len(counts)
            mean_fc = sum(r.listing_urls for r in fc_rows) / len(fc_rows)
            print(f"| {platform} | " + " | ".join(pct_cells) + f" | {mean_brave:.1f} | {mean_fc:.1f} |")

        # Per-search cost at each threshold: Brave always + Firecrawl when fallback fires.
        print("\n### Projected cost per user search at each threshold")
        print("Brave runs on every platform. Firecrawl fires only on platforms where Brave returned < N.")
        print("| Threshold N | Mean fallback-firing platforms | Cost (Hobby FC) | Cost (Standard FC) |")
        print("|---|---|---|---|")
        for n in thresholds:
            # Per query: count how many platforms in this query had Brave < N → fallback fires for each
            fallback_fires_per_query = []
            for q in queries:
                fires = 0
                for platform in PLATFORMS:
                    brave_r = next((r for r in rows if r.provider == "brave" and r.query == q and r.platform == platform), None)
                    if brave_r and not brave_r.error and brave_r.listing_urls < n:
                        fires += 1
                fallback_fires_per_query.append(fires)
            mean_fires = sum(fallback_fires_per_query) / len(fallback_fires_per_query) if fallback_fires_per_query else 0
            brave_cost = brave_total_cost_per_search  # always all 8
            hobby_fb = mean_fires * FIRECRAWL_COST_HOBBY
            std_fb = mean_fires * FIRECRAWL_COST_STANDARD
            print(
                f"| ≥{n} | {mean_fires:.1f} / 8 | "
                f"${brave_cost + hobby_fb:.4f} (vs ${fc_total_cost_per_search:.4f} pure FC, "
                f"{(1 - (brave_cost + hobby_fb) / fc_total_cost_per_search) * 100:.0f}% savings) | "
                f"${brave_cost + std_fb:.4f} |"
            )

        # Coverage at each threshold: how many total listings would the hybrid return vs pure Firecrawl?
        print("\n### Listing-URL coverage at each threshold")
        print("Hybrid = Brave's listings when ≥N, else Firecrawl's listings. Compared to pure Firecrawl baseline.")
        print("| Threshold N | Hybrid listings | Pure Firecrawl | Coverage |")
        print("|---|---|---|---|")
        fc_total_listings = sum(r.listing_urls for r in rows if r.provider == "firecrawl" and not r.error)
        for n in thresholds:
            hybrid_listings = 0
            for q in queries:
                for platform in PLATFORMS:
                    brave_r = next((r for r in rows if r.provider == "brave" and r.query == q and r.platform == platform), None)
                    fc_r = next((r for r in rows if r.provider == "firecrawl" and r.query == q and r.platform == platform), None)
                    if brave_r and not brave_r.error and brave_r.listing_urls >= n:
                        hybrid_listings += brave_r.listing_urls
                    elif fc_r and not fc_r.error:
                        hybrid_listings += fc_r.listing_urls
            pct = 100 * hybrid_listings / fc_total_listings if fc_total_listings else 0
            print(f"| ≥{n} | {hybrid_listings} | {fc_total_listings} | {pct:.0f}% |")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--big", action="store_true",
                    help="Use the 20-query set + Firecrawl/Brave only (skips Serper variants).")
    args = ap.parse_args()

    if args.big:
        queries = QUERIES_BIG
        providers = BIG_PROVIDERS
        required = ["FIRECRAWL_API_KEY", "BRAVE_API_KEY"]
    else:
        queries = QUERIES_SMALL
        providers = SMALL_PROVIDERS
        required = ["FIRECRAWL_API_KEY", "SERPER_API_KEY", "BRAVE_API_KEY"]

    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"Missing required env vars: {missing}", file=sys.stderr)
        return 1

    print(f"Running {len(queries)} queries × {len(PLATFORMS)} platforms × {len(providers)} providers "
          f"= {len(queries) * len(PLATFORMS) * len(providers)} calls", flush=True)
    rows = run(queries, providers)
    write_csv(rows)
    print_summary(rows, queries)
    return 0


if __name__ == "__main__":
    sys.exit(main())
