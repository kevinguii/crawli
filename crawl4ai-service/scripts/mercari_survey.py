"""One-off survey of Mercari's search page. Does NOT modify main.py.

Renders the Mercari search URL in headless Chromium, saves the HTML to
debug_dumps/, and prints structural signals so we can decide what to
extract from (__NEXT_DATA__, JSON-LD, raw DOM cards).

Run from the crawl4ai-service directory:
    ./venv/bin/python scripts/mercari_survey.py "fear of god essentials hoodie"
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig


CANDIDATE_URLS = [
    "https://www.mercari.com/search/?keyword={q}",
    "https://www.mercari.com/search?keyword={q}",
]


async def probe(query: str) -> None:
    q = quote(query.strip())
    dump_dir = Path(__file__).resolve().parent.parent / "debug_dumps"
    dump_dir.mkdir(exist_ok=True)

    async with AsyncWebCrawler(headless=True, verbose=False) as crawler:
        for tmpl in CANDIDATE_URLS:
            url = tmpl.format(q=q)
            print(f"\n=== Probing: {url}")
            cfg = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                page_timeout=45_000,
                wait_until="domcontentloaded",
                delay_before_return_html=5.0,
                remove_overlay_elements=False,
                remove_consent_popups=True,
            )
            result = await crawler.arun(url=url, config=cfg)
            print(f"  success={result.success}  status={getattr(result, 'status_code', '?')}")
            if not result.success:
                print(f"  error: {result.error_message[:300] if result.error_message else 'no message'}")
                continue

            html = result.html or ""
            print(f"  html_size={len(html):,} bytes")

            # Persist for offline inspection.
            stem = re.sub(r"[^a-z0-9]+", "_", tmpl.split('://')[1].split('?')[0].lower()).strip("_")
            out = dump_dir / f"mercari_search_{stem}.html"
            out.write_text(html)
            print(f"  saved: {out}")

            soup = BeautifulSoup(html, "lxml")
            report(soup, html)
            return  # first URL that loads wins


def report(soup: BeautifulSoup, html: str) -> None:
    # 1) __NEXT_DATA__ presence + shape
    nd = soup.find("script", id="__NEXT_DATA__")
    if nd and (nd.string or nd.text):
        body = nd.string or nd.text
        print(f"  __NEXT_DATA__: present ({len(body):,} bytes)")
        try:
            data = json.loads(body)
            # Walk shallow keys
            pp = data.get("props", {}).get("pageProps", {})
            print(f"  pageProps keys: {list(pp.keys())[:25]}")
            # Look for arrays of items
            for k, v in pp.items():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    sample = v[0]
                    sample_keys = list(sample.keys())[:15]
                    print(f"    pageProps['{k}']: list[{len(v)}], item keys={sample_keys}")
                elif isinstance(v, dict):
                    # nested dict — print one level of keys
                    sub_keys = list(v.keys())[:15]
                    print(f"    pageProps['{k}']: dict keys={sub_keys}")
        except Exception as exc:  # noqa: BLE001
            print(f"  __NEXT_DATA__ parse error: {exc}")
    else:
        print("  __NEXT_DATA__: ABSENT")

    # 2) JSON-LD blocks
    ld_blocks = soup.find_all("script", attrs={"type": "application/ld+json"})
    print(f"  JSON-LD blocks: {len(ld_blocks)}")
    for i, tag in enumerate(ld_blocks[:5]):
        body = tag.string or tag.text
        if not body:
            continue
        try:
            data = json.loads(body)
            shape = type(data).__name__
            if isinstance(data, dict):
                print(f"    [{i}] dict, @type={data.get('@type')}, keys={list(data.keys())[:10]}")
            elif isinstance(data, list):
                t0 = data[0].get('@type') if data and isinstance(data[0], dict) else None
                print(f"    [{i}] list[{len(data)}], first @type={t0}")
            else:
                print(f"    [{i}] {shape}")
        except Exception as exc:  # noqa: BLE001
            print(f"    [{i}] parse error: {exc}")

    # 3) Likely listing-card anchors
    item_anchors = soup.select("a[href*='/us/item/'], a[href*='/item/']")
    print(f"  /item/ anchors: {len(item_anchors)}")
    if item_anchors:
        sample_hrefs = list({a.get("href") for a in item_anchors if a.get("href")})[:5]
        for h in sample_hrefs:
            print(f"    {h}")

    # 4) data-testid hints commonly used by Mercari
    testid_set = set()
    for el in soup.find_all(attrs={"data-testid": True}):
        testid_set.add(el["data-testid"])
    rel = sorted([t for t in testid_set if "item" in t.lower() or "card" in t.lower() or "price" in t.lower()])
    print(f"  notable data-testid values: {rel[:25]}")

    # 5) Sniff for blockers
    if "Access Denied" in html or "captcha" in html.lower() or "blocked" in html.lower():
        print("  WARNING: page text contains 'Access Denied' / 'captcha' / 'blocked'")


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "fear of god essentials hoodie"
    asyncio.run(probe(query))
