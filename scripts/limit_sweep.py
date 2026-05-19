#!/usr/bin/env python3
"""Limit sweep: measure cost / time / dup-rate at per-platform-limit 5, 10, 15.

Mirrors app/api/search/route.ts:searchAndScrape() in a standalone harness so
production code stays untouched.

Pipeline replicated:
    1. SEARCH_PAGE_PLATFORMS (thredup) → POST /scrape-search to sidecar
    2. everything else                → Firecrawl search (`site:domain query`,
       limit=N) → slice top-N → POST /scrape per URL to sidecar (concurrency 2)

What it measures, per limit value:
    total wallclock
    listings returned (after dedup)
    duplicate rate (same-title listings across platforms)
    firecrawl_search_credits + estimated $
    failure rate

Usage:
    # Make sure sidecar is up: `npm run dev:sidecar` (or `npm run dev:all`).
    # If you want real LLM token totals in the output:
    #     export TOKEN_TRACKING=1   # then restart sidecar
    python scripts/limit_sweep.py --query "gucci bag" --limits 5 10 15
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

ROOT = Path(__file__).resolve().parents[1]
TOKEN_LOG = ROOT / "token_usage.jsonl"

SIDECAR_URL = os.environ.get("CRAWL4AI_URL", "http://localhost:8000")

PRICE_HOBBY = 20 / 5000
PRICE_STANDARD = 99 / 100_000

# OpenAI gpt-4o-mini pricing — keep in sync with TOKEN_COST_ANALYSIS.md.
GPT4O_MINI_IN = 0.15 / 1_000_000
GPT4O_MINI_OUT = 0.60 / 1_000_000

# Same set as production. ThredUp uses /scrape-search (no Firecrawl).
DEFAULT_PLATFORMS = ["grailed", "depop", "poshmark", "mercari", "vinted", "stockx", "ebay", "vestiaire", "thredup"]
SEARCH_PAGE_PLATFORMS = {"thredup"}  # mirrors lib/scraper.ts SEARCH_PAGE_PLATFORMS

PLATFORM_DOMAINS = {
    "grailed": "grailed.com",
    "depop": "depop.com",
    "poshmark": "poshmark.com",
    "mercari": "mercari.com",
    "vinted": "vinted.com",
    "stockx": "stockx.com",
    "ebay": "ebay.com",
    "vestiaire": "vestiairecollective.com",
    "thredup": "thredup.com",
}


@dataclass
class LimitResult:
    limit: int
    wallclock_s: float
    listings_total: int
    listings_with_price: int
    duplicate_rate: float
    failed_platforms: int
    firecrawl_search_credits: int
    cost_firecrawl_hobby: float
    cost_firecrawl_std: float
    cost_openai: float
    cost_total_hobby: float
    cost_total_std: float
    per_platform: dict


def _make_firecrawl():
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        raise RuntimeError("FIRECRAWL_API_KEY not set in env")
    from firecrawl import Firecrawl
    return Firecrawl(api_key=api_key)


def _firecrawl_search_credits(limit: int) -> int:
    """Firecrawl charges 2 credits per 10 results, rounded up."""
    return 2 * ((limit + 9) // 10)


async def _scrape_url(client: httpx.AsyncClient, url: str, platform: str) -> Optional[dict]:
    try:
        resp = await client.post(
            f"{SIDECAR_URL}/scrape",
            json={"url": url, "platform": platform},
            timeout=90,
        )
        if resp.status_code != 200:
            return None
        return resp.json().get("result")
    except Exception:  # noqa: BLE001
        return None


async def _scrape_search_page(client: httpx.AsyncClient, platform: str, query: str, limit: int) -> list[dict]:
    try:
        resp = await client.post(
            f"{SIDECAR_URL}/scrape-search",
            json={"platform": platform, "query": query, "limit": limit},
            timeout=120,
        )
        if resp.status_code != 200:
            return []
        return resp.json().get("results", []) or []
    except Exception:  # noqa: BLE001
        return []


async def _bounded_gather(coros, concurrency: int):
    """asyncio.gather-equivalent with a concurrency cap, preserving order."""
    sem = asyncio.Semaphore(concurrency)
    async def _go(c):
        async with sem:
            return await c
    return await asyncio.gather(*(_go(c) for c in coros), return_exceptions=False)


async def _platform_pipeline(
    fc, client: httpx.AsyncClient, platform: str, query: str, limit: int
) -> tuple[list[dict], dict]:
    """Returns (listings, per-platform-stats)."""
    stats = {"firecrawl_credits": 0, "failed": False, "url_count": 0, "scrape_count": 0}

    if platform in SEARCH_PAGE_PLATFORMS:
        # No Firecrawl, sidecar handles search-page grid. Limit honored directly.
        results = await _scrape_search_page(client, platform, query, limit)
        stats["url_count"] = len(results)
        stats["scrape_count"] = len(results)
        return results, stats

    # Firecrawl search at this limit.
    domain = PLATFORM_DOMAINS[platform]
    site_query = f"site:{domain} {query}"
    try:
        sr = fc.search(query=site_query, limit=limit)
        web = getattr(sr, "web", None) or []
        urls = []
        for item in web:
            u = getattr(item, "url", None) or (item.get("url") if isinstance(item, dict) else None)
            if u and u not in urls:
                urls.append(u)
    except Exception:  # noqa: BLE001
        stats["failed"] = True
        return [], stats

    stats["firecrawl_credits"] = _firecrawl_search_credits(limit)
    stats["url_count"] = len(urls)

    # Mirror prod: concurrency = 2 per platform.
    urls_to_scrape = urls[:limit]
    scrape_coros = [_scrape_url(client, u, platform) for u in urls_to_scrape]
    scraped = await _bounded_gather(scrape_coros, concurrency=2)
    listings = [s for s in scraped if s is not None]
    stats["scrape_count"] = len(listings)
    return listings, stats


def _openai_cost_from_log(token_log: Path, since_ts: float) -> float:
    """Sum gpt-4o-mini cost from token_usage.jsonl rows newer than since_ts.

    Returns 0.0 if the file doesn't exist (TOKEN_TRACKING off or no calls).
    """
    if not token_log.exists():
        return 0.0
    cost = 0.0
    try:
        with open(token_log) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ts = row.get("timestamp", "")
                # Best-effort: token_tracker writes ISO timestamps.
                if not ts:
                    continue
                try:
                    from datetime import datetime
                    if datetime.fromisoformat(ts).timestamp() < since_ts:
                        continue
                except Exception:
                    continue
                cost += row.get("input_tokens", 0) * GPT4O_MINI_IN
                cost += row.get("output_tokens", 0) * GPT4O_MINI_OUT
    except Exception:  # noqa: BLE001
        return 0.0
    return cost


async def run_one_limit(query: str, limit: int, platforms: list[str]) -> LimitResult:
    print(f"\n=== limit = {limit} ===")
    fc = _make_firecrawl()
    t0 = time.monotonic()
    log_marker = t0  # epoch seconds at which this run started
    async with httpx.AsyncClient() as client:
        # Mirror prod: all platforms in parallel.
        platform_results = await asyncio.gather(
            *(_platform_pipeline(fc, client, p, query, limit) for p in platforms)
        )
    wallclock = time.monotonic() - t0

    all_listings: list[dict] = []
    per_platform: dict[str, dict] = {}
    fc_credits = 0
    failed = 0
    for platform, (listings, stats) in zip(platforms, platform_results):
        all_listings.extend(listings)
        per_platform[platform] = {
            "listings": len(listings),
            "credits": stats["firecrawl_credits"],
            "failed": stats["failed"],
            "url_count": stats["url_count"],
            "scrape_count": stats["scrape_count"],
        }
        fc_credits += stats["firecrawl_credits"]
        if stats["failed"]:
            failed += 1
        print(f"  {platform:10}: {len(listings):>3} listings · "
              f"{stats['firecrawl_credits']:>2} Firecrawl credits · "
              f"{'FAILED' if stats['failed'] else 'ok'}")

    # Dup rate: how many listings share a title across platforms.
    titles = [(l.get("title") or "").strip().lower() for l in all_listings if l.get("title")]
    title_counts = Counter(titles)
    dups = sum(c for c in title_counts.values() if c > 1)
    dup_rate = (dups / len(titles)) if titles else 0.0

    with_price = sum(1 for l in all_listings if l.get("price") is not None)

    openai_cost = _openai_cost_from_log(TOKEN_LOG, log_marker)
    fc_hobby = fc_credits * PRICE_HOBBY
    fc_std = fc_credits * PRICE_STANDARD

    return LimitResult(
        limit=limit,
        wallclock_s=round(wallclock, 2),
        listings_total=len(all_listings),
        listings_with_price=with_price,
        duplicate_rate=round(dup_rate, 3),
        failed_platforms=failed,
        firecrawl_search_credits=fc_credits,
        cost_firecrawl_hobby=round(fc_hobby, 4),
        cost_firecrawl_std=round(fc_std, 4),
        cost_openai=round(openai_cost, 4),
        cost_total_hobby=round(fc_hobby + openai_cost, 4),
        cost_total_std=round(fc_std + openai_cost, 4),
        per_platform=per_platform,
    )


def print_comparison(rows: list[LimitResult]) -> None:
    print()
    print("=" * 90)
    print("LIMIT SWEEP SUMMARY")
    print("=" * 90)
    print()
    print("| Limit | Wall (s) | Listings | With price | Dup rate | Failed | FC credits | $ Hobby | $ Std |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        print(
            f"| {r.limit} | {r.wallclock_s} | {r.listings_total} | {r.listings_with_price} "
            f"| {r.duplicate_rate} | {r.failed_platforms} | {r.firecrawl_search_credits} "
            f"| ${r.cost_total_hobby} | ${r.cost_total_std} |"
        )
    print()
    if any(r.cost_openai > 0 for r in rows):
        print(f"OpenAI cost captured via token_usage.jsonl (TOKEN_TRACKING active).")
    else:
        print(f"OpenAI cost: 0.0 — either TOKEN_TRACKING is off or no LLM extractions ran.")
        print(f"  (Enable real tracking: export TOKEN_TRACKING=1 && restart sidecar.)")


async def amain():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="gucci bag")
    ap.add_argument("--limits", nargs="+", type=int, default=[5, 10, 15])
    ap.add_argument("--platforms", nargs="+", default=DEFAULT_PLATFORMS)
    args = ap.parse_args()

    print(f"Query:     {args.query!r}")
    print(f"Limits:    {args.limits}")
    print(f"Platforms: {args.platforms}")

    # Sidecar reachability check.
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{SIDECAR_URL}/health")
            r.raise_for_status()
    except Exception as e:  # noqa: BLE001
        print(f"\n[FATAL] sidecar at {SIDECAR_URL} unreachable: {e}")
        print("Start it with `npm run dev:sidecar` or `npm run dev:all`.")
        sys.exit(1)

    rows: list[LimitResult] = []
    for limit in args.limits:
        rows.append(await run_one_limit(args.query, limit, args.platforms))

    print_comparison(rows)

    out = ROOT / "scripts" / f"limit_sweep_{args.query.replace(' ', '_')}.json"
    out.write_text(json.dumps([r.__dict__ for r in rows], indent=2))
    print(f"\nSaved {out}")


if __name__ == "__main__":
    asyncio.run(amain())
