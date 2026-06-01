"""One-off probe: does Poshmark emit usable JSON-LD on listing pages?

Mirrors PRODUCTION fetch settings for poshmark (see main.py):
  BrowserConfig(headless=True, enable_stealth=True, user_agent_mode="random")
  CrawlerRunConfig(cache_mode=BYPASS, page_timeout=50_000,
                   wait_until="domcontentloaded", delay_before_return_html=6.0,
                   remove_overlay_elements=False, remove_consent_popups=True)
  (structured/CSS tier runs scope_to_target=False -> no target_elements,
   full HTML incl. <head> survives.)

Flow:
  1. Render a Poshmark search page, harvest real /listing/ anchors (no invented URLs).
  2. For each sampled listing, render it and report, side by side:
       - JSON-LD block count + each @type (and whether a Product node exists)
       - _extract_from_jsonld(soup)  -> what a JSON-LD migration WOULD return
       - extract_poshmark(html)      -> what production returns TODAY
       - ground-truth signals visible on the page (og:title, h1 price spans,
         sold banner, inventory_status attr)
  Does NOT modify main.py or any extractor.

Run from the crawl4ai-service directory:
    ./venv/bin/python scripts/poshmark_jsonld_probe.py "fear of god hoodie" [N]
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

# Make the service package importable when run from scripts/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Reuse the ACTUAL project code so the comparison reflects reality.
from structured_extractors import _extract_from_jsonld, extract_poshmark  # noqa: E402


SEARCH_URLS = [
    "https://poshmark.com/search?query={q}",
    "https://poshmark.com/search?query={q}&type=listings",
]

# When SOLD mode is on (CLI: 3rd arg == "sold"), bias the search toward sold
# listings so we can validate availability -> isSold mapping.
SOLD_SEARCH_URLS = [
    "https://poshmark.com/search?query={q}&availability=sold_out",
    "https://poshmark.com/search?query={q}&availability=sold",
]

DUMP_DIR = Path(__file__).resolve().parent.parent / "debug_dumps" / "poshmark_jsonld"

LISTING_CFG = dict(
    cache_mode=CacheMode.BYPASS,
    page_timeout=50_000,
    wait_until="domcontentloaded",
    delay_before_return_html=6.0,
    remove_overlay_elements=False,
    remove_consent_popups=True,
)


def make_browser() -> BrowserConfig:
    return BrowserConfig(
        headless=True,
        verbose=False,
        enable_stealth=True,
        user_agent_mode="random",
    )


# Hard wall-clock cap per render. crawl4ai's page_timeout is not honored when the
# driver dies (the await hangs forever), so we wrap every arun in wait_for.
RENDER_HARD_TIMEOUT = 75.0


async def safe_arun(crawler: AsyncWebCrawler, url: str):
    """arun with a hard timeout so a dead driver can't hang the whole probe."""
    cfg = CrawlerRunConfig(**LISTING_CFG)
    try:
        return await asyncio.wait_for(crawler.arun(url=url, config=cfg), RENDER_HARD_TIMEOUT)
    except asyncio.TimeoutError:
        print(f"  !! render exceeded {RENDER_HARD_TIMEOUT:.0f}s hard timeout — skipping", flush=True)
        return None


async def harvest_listing_urls(crawler: AsyncWebCrawler, query: str, want: int, sold: bool = False) -> list[str]:
    q = quote(query.strip())
    templates = SOLD_SEARCH_URLS if sold else SEARCH_URLS
    for tmpl in templates:
        url = tmpl.format(q=q)
        print(f"\n=== search: {url}", flush=True)
        result = await safe_arun(crawler, url)
        if result is None:
            continue
        print(f"  success={result.success} status={getattr(result,'status_code','?')} "
              f"html={len(result.html or ''):,}b", flush=True)
        if not result.success or not result.html:
            continue
        soup = BeautifulSoup(result.html, "lxml")
        hrefs: list[str] = []
        seen = set()
        for a in soup.select("a[href*='/listing/']"):
            h = a.get("href")
            if not h:
                continue
            full = urljoin("https://poshmark.com", h.split("?")[0])
            if "/listing/" in full and full not in seen:
                seen.add(full)
                hrefs.append(full)
        print(f"  harvested {len(hrefs)} unique /listing/ urls")
        if hrefs:
            return hrefs[:want]
    return []


def jsonld_report(soup: BeautifulSoup) -> None:
    blocks = soup.find_all("script", attrs={"type": "application/ld+json"})
    print(f"  JSON-LD blocks: {len(blocks)}")
    found_product = False
    for i, tag in enumerate(blocks):
        body = tag.string or tag.text
        if not body:
            print(f"    [{i}] empty body")
            continue
        try:
            data = json.loads(body)
        except Exception as exc:  # noqa: BLE001
            print(f"    [{i}] parse error: {exc}")
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get("@type")
            keys = list(node.keys())[:12]
            print(f"    [{i}] @type={t} keys={keys}")
            types = t if isinstance(t, list) else [t]
            if any(isinstance(x, str) and x.lower() == "product" for x in types):
                found_product = True
                offers = node.get("offers")
                print(f"        -> PRODUCT. offers={_short(offers)}")
                print(f"        -> name={_short(node.get('name'))} "
                      f"image={_short(node.get('image'))}")
    print(f"  Product node present: {found_product}")


def groundtruth(soup: BeautifulSoup, html: str) -> None:
    og_title = soup.find("meta", property="og:title")
    og_type = soup.find("meta", property="og:type")
    print(f"  og:title={_short(og_title.get('content') if og_title else None)}")
    print(f"  og:type={_short(og_type.get('content') if og_type else None)}")
    h1 = soup.find("p", class_="h1")
    if h1:
        spans = [s.get_text(strip=True) for s in h1.find_all("span")]
        print(f"  <p class=h1> spans={spans}")
    else:
        print("  <p class=h1>: ABSENT")
    inv = re.search(r'data-et-prop-inventory_status="([^"]*)"', html)
    print(f"  inventory_status attr={inv.group(1) if inv else None}")
    sold_banner = soup.find(class_="listing__status-banner__title--sold") is not None
    print(f"  sold-banner element: {sold_banner}")


def _short(v, n: int = 90) -> str:
    s = json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[:n] + "…"


async def probe_listing(crawler: AsyncWebCrawler, url: str, idx: int) -> None:
    print(f"\n########## LISTING {idx}: {url}", flush=True)
    result = await safe_arun(crawler, url)
    if result is None:
        return
    print(f"  success={result.success} status={getattr(result,'status_code','?')} "
          f"html={len(result.html or ''):,}b", flush=True)
    if not result.success or not result.html:
        print(f"  error: {(result.error_message or '')[:200]}")
        return
    html = result.html
    DUMP_DIR.mkdir(parents=True, exist_ok=True)
    stem = re.sub(r"[^a-z0-9]+", "_", url.rsplit("/", 1)[-1].lower()).strip("_")[:60]
    (DUMP_DIR / f"{idx:02d}_{stem}.html").write_text(html)
    soup = BeautifulSoup(html, "lxml")

    print("  --- ground truth (visible signals) ---")
    groundtruth(soup, html)
    print("  --- JSON-LD survey ---")
    jsonld_report(soup)
    print("  --- _extract_from_jsonld (what a JSON-LD migration WOULD return) ---")
    print(f"    {_short(_extract_from_jsonld(soup), 300)}")
    print("  --- extract_poshmark (production TODAY) ---")
    print(f"    {_short(extract_poshmark(html), 300)}")


async def main() -> None:
    query = sys.argv[1] if len(sys.argv) > 1 else "fear of god hoodie"
    want = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    sold = len(sys.argv) > 3 and sys.argv[3].lower() == "sold"
    print(f"MODE: {'SOLD' if sold else 'AVAILABLE'}  query={query!r} want={want}", flush=True)

    async with AsyncWebCrawler(config=make_browser()) as crawler:
        urls = await harvest_listing_urls(crawler, query, want, sold=sold)
        if not urls:
            print("\nNo listing URLs harvested — search page may be blocked. Stop.")
            return
        print(f"\nProbing {len(urls)} listings...")
        for i, u in enumerate(urls, 1):
            try:
                await probe_listing(crawler, u, i)
            except Exception as exc:  # noqa: BLE001
                print(f"  LISTING {i} crashed: {exc}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
