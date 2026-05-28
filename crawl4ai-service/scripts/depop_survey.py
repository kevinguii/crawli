"""One-off survey of Depop's search page (parallel to mercari_survey.py).

Renders Depop's search URL in headless Chromium, saves the HTML to
debug_dumps/, and prints structural signals so we can decide what to
extract from (__NEXT_DATA__, JSON-LD, raw DOM cards).

Run from the crawl4ai-service directory:
    ./venv/bin/python scripts/depop_survey.py "fear of god essentials hoodie"
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
    "https://www.depop.com/search/?q={q}",
    "https://www.depop.com/search?q={q}",
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

            stem = re.sub(r"[^a-z0-9]+", "_", tmpl.split('://')[1].split('?')[0].lower()).strip("_")
            out = dump_dir / f"depop_search_{stem}.html"
            out.write_text(html)
            print(f"  saved: {out}")

            soup = BeautifulSoup(html, "lxml")
            report(soup, html)
            return


def report(soup: BeautifulSoup, html: str) -> None:
    nd = soup.find("script", id="__NEXT_DATA__")
    if nd and (nd.string or nd.text):
        body = nd.string or nd.text
        print(f"  __NEXT_DATA__: present ({len(body):,} bytes)")
        try:
            data = json.loads(body)
            pp = data.get("props", {}).get("pageProps", {})
            print(f"  pageProps keys: {list(pp.keys())[:25]}")
            for k, v in pp.items():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    sample_keys = list(v[0].keys())[:15]
                    print(f"    pageProps['{k}']: list[{len(v)}], item keys={sample_keys}")
                elif isinstance(v, dict):
                    sub_keys = list(v.keys())[:15]
                    print(f"    pageProps['{k}']: dict keys={sub_keys}")
        except Exception as exc:  # noqa: BLE001
            print(f"  __NEXT_DATA__ parse error: {exc}")
    else:
        print("  __NEXT_DATA__: ABSENT")

    ld_blocks = soup.find_all("script", attrs={"type": "application/ld+json"})
    print(f"  JSON-LD blocks: {len(ld_blocks)}")
    for i, tag in enumerate(ld_blocks[:5]):
        body = tag.string or tag.text
        if not body:
            continue
        try:
            data = json.loads(body)
            if isinstance(data, dict):
                print(f"    [{i}] dict, @type={data.get('@type')}, keys={list(data.keys())[:10]}")
            elif isinstance(data, list):
                t0 = data[0].get('@type') if data and isinstance(data[0], dict) else None
                print(f"    [{i}] list[{len(data)}], first @type={t0}")
        except Exception as exc:  # noqa: BLE001
            print(f"    [{i}] parse error: {exc}")

    # Depop product URL pattern: /products/<seller>-<slug>/
    # Try multiple anchor patterns to find listing cards.
    for sel in ["a[href*='/products/']", "a[data-testid*='product']", "a[data-testid*='Product']"]:
        anchors = soup.select(sel)
        print(f"  '{sel}': {len(anchors)} anchors")
        if anchors:
            sample = list({a.get("href") for a in anchors if a.get("href")})[:5]
            for h in sample:
                print(f"    {h}")
            break

    testid_set = set()
    for el in soup.find_all(attrs={"data-testid": True}):
        testid_set.add(el["data-testid"])
    rel = sorted([t for t in testid_set if any(w in t.lower() for w in ("product", "card", "price", "item", "listing"))])
    print(f"  notable data-testid values: {rel[:30]}")

    # Sniff for blockers
    if "Access Denied" in html or "Pardon Our Interruption" in html:
        print("  WARNING: page text contains 'Access Denied' / 'Pardon Our Interruption'")
    if "<title>" in html.lower():
        m = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if m:
            print(f"  <title>: {m.group(1).strip()[:120]}")


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "fear of god essentials hoodie"
    asyncio.run(probe(query))
