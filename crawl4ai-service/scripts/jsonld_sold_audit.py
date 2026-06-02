"""Cross-platform SOLD-status audit for JSON-LD extractors — no main.py changes.

For a given platform it harvests listing URLs (sold-biased where possible),
renders each, and reports the JSON-LD signals that decide isSold:
  - Product node present?
  - offers.availability raw value
  - offers.price present? (the price-gate in _extract_from_jsonld drops the WHOLE
    result to None when price is missing — which would also drop a sold signal)
  - what the ACTUAL platform extractor returns (isSold / price / None)

Harvest modes:
  * Generic: --search-url '<url>' --selector "a[href*='/itm/']"
  * Built-in: --platform depop|grailed|thredup  (uses search_url_for +
    extract_search_grid, the same harvesters production uses)

Examples:
  # eBay SOLD/completed listings
  ./venv/bin/python scripts/jsonld_sold_audit.py --platform ebay \
      --search-url 'https://www.ebay.com/sch/i.html?_nkw=gucci+marmont+bag&LH_Sold=1&LH_Complete=1' \
      --selector "a[href*='/itm/']" --n 6

  # Depop (sold listings stay live; normal search yields a mix)
  ./venv/bin/python scripts/jsonld_sold_audit.py --platform depop --query "fear of god essentials" --n 8
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from structured_extractors import PLATFORM_EXTRACTORS, _find_product_jsonld  # noqa: E402
from search_page_extractors import search_url_for, extract_search_grid  # noqa: E402

RENDER_HARD_TIMEOUT = 80.0
RUN_CFG = dict(
    cache_mode=CacheMode.BYPASS,
    page_timeout=60_000,
    wait_until="domcontentloaded",
    delay_before_return_html=6.0,
    remove_overlay_elements=False,
    remove_consent_popups=True,
)

BASES = {
    "ebay": "https://www.ebay.com",
    "depop": "https://www.depop.com",
    "grailed": "https://www.grailed.com",
    "thredup": "https://www.thredup.com",
    "vestiaire": "https://us.vestiairecollective.com",
}


def make_browser() -> BrowserConfig:
    return BrowserConfig(headless=True, verbose=False, enable_stealth=True, user_agent_mode="random")


async def safe_arun(crawler, url):
    try:
        return await asyncio.wait_for(crawler.arun(url=url, config=CrawlerRunConfig(**RUN_CFG)), RENDER_HARD_TIMEOUT)
    except asyncio.TimeoutError:
        print(f"  !! render exceeded {RENDER_HARD_TIMEOUT:.0f}s — skipping", flush=True)
        return None


async def harvest(crawler, platform, query, search_url, selector, want):
    url = search_url or search_url_for(platform, query)
    if not url:
        print(f"  no search URL for {platform} (pass --search-url)"); return []
    print(f"\n=== search: {url}", flush=True)
    res = await safe_arun(crawler, url)
    if res is None or not res.success or not res.html:
        print(f"  search render failed (success={getattr(res,'success',None)})"); return []
    print(f"  html={len(res.html):,}b", flush=True)
    urls = []
    if selector:
        soup = BeautifulSoup(res.html, "lxml")
        seen = set()
        for a in soup.select(selector):
            h = a.get("href")
            if not h:
                continue
            full = urljoin(BASES.get(platform, ""), h.split("?")[0])
            if full not in seen:
                seen.add(full); urls.append(full)
    else:
        grid = extract_search_grid(platform, res.html, limit=want * 3)
        urls = [row["url"] for row in grid if row.get("url")]
    print(f"  harvested {len(urls)} listing urls", flush=True)
    return urls[:want]


def _avail_and_price(soup):
    prod = _find_product_jsonld(soup)
    if not prod:
        return None, None, None, False
    offers = prod.get("offers")
    o = offers[0] if isinstance(offers, list) and offers else (offers if isinstance(offers, dict) else {})
    o = o or {}
    avail = o.get("availability") or prod.get("availability")
    price = o.get("price")
    if price is None:
        price = prod.get("price")
    cond = o.get("itemCondition") or prod.get("itemCondition")
    return avail, price, cond, True


async def audit(crawler, platform, url, idx):
    print(f"\n#### {platform} [{idx}]: {url}", flush=True)
    res = await safe_arun(crawler, url)
    if res is None or not res.success or not res.html:
        print(f"  render failed (success={getattr(res,'success',None)})"); return
    html = res.html
    soup = BeautifulSoup(html, "lxml")
    avail, raw_price, raw_cond, has_prod = _avail_and_price(soup)
    fn = PLATFORM_EXTRACTORS[platform]
    out = fn(html)
    # Flag the danger case: sold-signal present in JSON-LD but extractor returned None
    avail_says_sold = isinstance(avail, str) and any(t in avail.lower().replace("_", "") for t in ("outofstock", "soldout", "discontinued"))
    danger = avail_says_sold and out is None
    flag = "  <<< SOLD SIGNAL DROPPED" if danger else ""
    print(f"  prod_node={has_prod} availability={avail} jsonld_price={raw_price!r} cond={raw_cond}", flush=True)
    print(f"  extractor -> {json.dumps(out) if out else None}{flag}", flush=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", required=True)
    ap.add_argument("--query", default="")
    ap.add_argument("--search-url", default="")
    ap.add_argument("--selector", default="")
    ap.add_argument("--n", type=int, default=6)
    args = ap.parse_args()
    print(f"PLATFORM={args.platform} query={args.query!r} n={args.n}", flush=True)

    async with AsyncWebCrawler(config=make_browser()) as crawler:
        urls = await harvest(crawler, args.platform, args.query, args.search_url, args.selector, args.n)
        if not urls:
            print("\nNo URLs harvested — stop."); return
        for i, u in enumerate(urls, 1):
            try:
                await audit(crawler, args.platform, u, i)
            except Exception as exc:  # noqa: BLE001
                print(f"  [{i}] crashed: {exc}")
            await asyncio.sleep(2)
    print("\nDONE", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
