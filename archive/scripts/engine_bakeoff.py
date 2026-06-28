#!/usr/bin/env python3
"""Engine bake-off: crawl4ai vs Firecrawl scrape on a fixed URL set.

Two modes:

    # 1) One-time: collect URLs via Firecrawl search and save fixture.
    python scripts/engine_bakeoff.py --build-fixture

    # 2) Run the bake-off using the saved fixture.
    python scripts/engine_bakeoff.py --run

Output: scripts/bakeoff_results.csv (one row per attempt).
        Plus a markdown table printed to stdout.

What it measures, per (engine, platform, url):
    fetch_ok        — did the engine return content without raising?
    title_ok        — title-like field present?
    price_ok        — price-like field present (numeric)?
    wallclock_ms    — round-trip latency
    cost_usd_hobby  — estimated $ on Firecrawl Hobby plan
    cost_usd_std    — estimated $ on Firecrawl Standard plan
    notes           — error / qualitative observations

Engines:
    crawl4ai            — POST /scrape on the sidecar (current production path)
    firecrawl-basic     — Firecrawl scrape, markdown only (1 credit/URL)
    firecrawl-stealth   — Firecrawl scrape with proxy='stealth' (5 credits/URL).
                          Only runs on platforms in STEALTH_TARGETS.

Pricing source of truth: docs/FIRECRAWL_PRICING.md.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

import httpx

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = ROOT / "scripts" / "bakeoff_fixture.json"
RESULTS_PATH = ROOT / "scripts" / "bakeoff_results.csv"

# Pricing — keep in sync with docs/FIRECRAWL_PRICING.md.
PRICE_HOBBY = 20 / 5000          # $0.004/credit
PRICE_STANDARD = 99 / 100_000    # $0.00099/credit

# Bake-off scope. Small intentionally — see plan doc.
QUERIES = ["gucci bag", "nike air jordan 1", "levis 501 jeans"]
PLATFORMS = ["grailed", "depop", "poshmark", "mercari", "vinted", "stockx", "ebay", "vestiaire"]
# Skip thredup (search-page extractor, not a per-URL scrape) and realreal (deferred).

# Platforms where crawl4ai struggles; worth burning extra credits on Firecrawl stealth.
STEALTH_TARGETS = {"ebay", "vestiaire"}

# How many URLs per (query, platform) to test. 3 keeps total at 72 URLs.
URLS_PER_BUCKET = 3

# Firecrawl search limit when building fixture. Lower → cheaper. 10 = 2 credits/platform.
SEARCH_LIMIT_FOR_FIXTURE = 10

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

SIDECAR_URL = os.environ.get("CRAWL4AI_URL", "http://localhost:8000")
PRICE_REGEX = re.compile(r"(?:USD|EUR|GBP|\$|€|£)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP)")


@dataclass
class Attempt:
    query: str
    platform: str
    url: str
    engine: str
    fetch_ok: bool = False
    title_ok: bool = False
    price_ok: bool = False
    wallclock_ms: int = 0
    credits: int = 0
    cost_usd_hobby: float = 0.0
    cost_usd_std: float = 0.0
    extracted_title: Optional[str] = None
    extracted_price: Optional[float] = None
    notes: str = ""


# ── Engine: crawl4ai (existing sidecar) ────────────────────────────────────

async def scrape_crawl4ai(url: str, platform: str) -> Attempt:
    a = Attempt(query="", platform=platform, url=url, engine="crawl4ai")
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                f"{SIDECAR_URL}/scrape",
                json={"url": url, "platform": platform},
            )
            if resp.status_code != 200:
                a.notes = f"HTTP {resp.status_code}"
                a.wallclock_ms = int((time.monotonic() - t0) * 1000)
                return a
            data = resp.json()
            listing = data.get("result")
            a.wallclock_ms = int((time.monotonic() - t0) * 1000)
            if listing is None:
                a.notes = "sidecar returned null"
                return a
            a.fetch_ok = True
            a.extracted_title = listing.get("title")
            price = listing.get("price")
            a.title_ok = bool(a.extracted_title)
            a.price_ok = price is not None and isinstance(price, (int, float))
            if a.price_ok:
                a.extracted_price = float(price)
    except httpx.HTTPError as e:
        a.notes = f"http error: {e}"[:200]
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
    except Exception as e:  # noqa: BLE001
        a.notes = f"err: {e}"[:200]
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
    return a


# ── Engine: Firecrawl scrape ───────────────────────────────────────────────

def _make_firecrawl():
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        raise RuntimeError("FIRECRAWL_API_KEY not set in env")
    from firecrawl import Firecrawl
    return Firecrawl(api_key=api_key)


def scrape_firecrawl(url: str, platform: str, *, stealth: bool) -> Attempt:
    engine = "firecrawl-stealth" if stealth else "firecrawl-basic"
    a = Attempt(query="", platform=platform, url=url, engine=engine)
    credits = 5 if stealth else 1
    a.credits = credits
    a.cost_usd_hobby = credits * PRICE_HOBBY
    a.cost_usd_std = credits * PRICE_STANDARD

    t0 = time.monotonic()
    try:
        fc = _make_firecrawl()
        kwargs = dict(url=url, formats=["markdown"], only_main_content=True, timeout=60_000)
        if stealth:
            kwargs["proxy"] = "stealth"
        doc = fc.scrape(**kwargs)
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)

        markdown = getattr(doc, "markdown", None) or ""
        metadata = getattr(doc, "metadata", None) or {}
        title = metadata.get("title") if isinstance(metadata, dict) else getattr(metadata, "title", None)
        a.fetch_ok = bool(markdown)
        a.extracted_title = title
        a.title_ok = bool(title)
        # Heuristic price detection — does the page text contain something
        # that *looks* like a price? Not a guarantee, just signal.
        if markdown:
            head = markdown[:8000]
            match = PRICE_REGEX.search(head)
            if match:
                a.price_ok = True
                a.notes = f"price_hit={match.group(0)[:30]}"
                # Try to extract a numeric price from the match
                m2 = re.search(r"\d[\d,.]*", match.group(0))
                if m2:
                    try:
                        a.extracted_price = float(m2.group(0).replace(",", ""))
                    except ValueError:
                        pass
        if not a.fetch_ok:
            a.notes = "empty markdown"
    except Exception as e:  # noqa: BLE001
        a.notes = f"err: {type(e).__name__}: {str(e)[:160]}"
        a.wallclock_ms = int((time.monotonic() - t0) * 1000)
    return a


# ── Fixture: collect URLs to test against ──────────────────────────────────

def build_fixture() -> dict:
    """Use Firecrawl search to pick URLs once, then save."""
    fc = _make_firecrawl()
    fixture = {
        "queries": QUERIES,
        "platforms": PLATFORMS,
        "urls_per_bucket": URLS_PER_BUCKET,
        "search_limit": SEARCH_LIMIT_FOR_FIXTURE,
        "data": {},
    }
    total_credits = 0
    for query in QUERIES:
        fixture["data"][query] = {}
        for platform in PLATFORMS:
            domain = PLATFORM_DOMAINS[platform]
            site_query = f"site:{domain} {query}"
            try:
                resp = fc.search(query=site_query, limit=SEARCH_LIMIT_FOR_FIXTURE)
                web = getattr(resp, "web", None) or []
                urls = []
                for item in web:
                    u = getattr(item, "url", None) or (item.get("url") if isinstance(item, dict) else None)
                    if u:
                        urls.append(u)
                    if len(urls) >= URLS_PER_BUCKET:
                        break
                fixture["data"][query][platform] = urls
                total_credits += 2 * ((SEARCH_LIMIT_FOR_FIXTURE + 9) // 10)
                print(f"  [{query}] {platform}: {len(urls)} URLs")
            except Exception as e:  # noqa: BLE001
                print(f"  [{query}] {platform}: FAILED {e}")
                fixture["data"][query][platform] = []
    fixture["total_search_credits"] = total_credits
    fixture["estimated_cost_hobby"] = total_credits * PRICE_HOBBY
    fixture["estimated_cost_standard"] = total_credits * PRICE_STANDARD
    return fixture


def save_fixture(fixture: dict) -> None:
    FIXTURE_PATH.write_text(json.dumps(fixture, indent=2))
    print(f"\nSaved {FIXTURE_PATH}")
    print(f"Total search credits used: {fixture['total_search_credits']} "
          f"(${fixture['estimated_cost_hobby']:.4f} Hobby / "
          f"${fixture['estimated_cost_standard']:.4f} Standard)")


# ── Run mode ───────────────────────────────────────────────────────────────

async def run_bakeoff(fixture: dict, engines: list[str]) -> list[Attempt]:
    rows: list[Attempt] = []
    for query, platforms in fixture["data"].items():
        for platform, urls in platforms.items():
            for url in urls:
                for engine in engines:
                    if engine == "firecrawl-stealth" and platform not in STEALTH_TARGETS:
                        continue
                    print(f"  [{engine:18}] {platform:10} {url[:70]}", flush=True)
                    if engine == "crawl4ai":
                        a = await scrape_crawl4ai(url, platform)
                    elif engine == "firecrawl-basic":
                        a = scrape_firecrawl(url, platform, stealth=False)
                    elif engine == "firecrawl-stealth":
                        a = scrape_firecrawl(url, platform, stealth=True)
                    else:
                        continue
                    a.query = query
                    rows.append(a)
                    flag = "✓" if (a.title_ok and a.price_ok) else ("·" if a.fetch_ok else "✗")
                    print(f"     {flag} {a.wallclock_ms:>6} ms · {a.notes[:60]}")
    return rows


def write_csv(rows: list[Attempt]) -> None:
    if not rows:
        return
    cols = list(rows[0].__dict__.keys())
    with open(RESULTS_PATH, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow(asdict(r))
    print(f"\nWrote {RESULTS_PATH} ({len(rows)} rows)")


def print_summary(rows: list[Attempt]) -> None:
    by_engine: dict[str, list[Attempt]] = {}
    for r in rows:
        by_engine.setdefault(r.engine, []).append(r)
    print()
    print("| Engine | N | fetch_ok | title_ok | price_ok | p50 ms | p95 ms | total $ Hobby | total $ Std |")
    print("|---|---|---|---|---|---|---|---|---|")
    for engine, lst in by_engine.items():
        n = len(lst)
        fok = sum(1 for r in lst if r.fetch_ok)
        tok = sum(1 for r in lst if r.title_ok)
        pok = sum(1 for r in lst if r.price_ok)
        times = sorted(r.wallclock_ms for r in lst)
        p50 = times[n // 2] if n else 0
        p95 = times[min(n - 1, int(n * 0.95))] if n else 0
        total_h = sum(r.cost_usd_hobby for r in lst)
        total_s = sum(r.cost_usd_std for r in lst)
        pct = lambda v: f"{v}/{n} ({100*v//n if n else 0}%)"
        print(f"| {engine} | {n} | {pct(fok)} | {pct(tok)} | {pct(pok)} | {p50} | {p95} | ${total_h:.4f} | ${total_s:.4f} |")


# ── CLI ────────────────────────────────────────────────────────────────────

async def amain():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build-fixture", action="store_true",
                    help="One-time: collect URLs via Firecrawl search.")
    ap.add_argument("--run", action="store_true", help="Run the bake-off.")
    ap.add_argument(
        "--engines",
        nargs="*",
        default=["crawl4ai", "firecrawl-basic", "firecrawl-stealth"],
        help="Subset of engines to test.",
    )
    args = ap.parse_args()

    if not (args.build_fixture or args.run):
        ap.print_help()
        sys.exit(1)

    if args.build_fixture:
        if FIXTURE_PATH.exists():
            print(f"Fixture already exists at {FIXTURE_PATH}.")
            print("Delete it first if you want to rebuild. Skipping.")
            return
        print("Building fixture via Firecrawl search…")
        fixture = build_fixture()
        save_fixture(fixture)

    if args.run:
        if not FIXTURE_PATH.exists():
            print(f"No fixture at {FIXTURE_PATH}. Run with --build-fixture first.")
            sys.exit(1)
        fixture = json.loads(FIXTURE_PATH.read_text())
        print(f"Loaded fixture with "
              f"{sum(len(urls) for q in fixture['data'].values() for urls in q.values())} URLs")
        rows = await run_bakeoff(fixture, args.engines)
        write_csv(rows)
        print_summary(rows)


if __name__ == "__main__":
    asyncio.run(amain())
