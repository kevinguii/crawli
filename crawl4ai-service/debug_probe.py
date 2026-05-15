"""Debug probe: dump price-related signals from a listing page.

Usage:
    python debug_probe.py <url> [<url> ...]

Prints, per URL:
  - All <meta> tags whose property/name/itemprop contains 'price', 'og:', or 'product:'
  - All JSON-LD blocks (truncated to price-relevant keys)
  - First ~10 visible text snippets that look like "$NN" (with surrounding context)
  - What OG_PRODUCT_SCHEMA currently extracts

No LLM calls. Reuses the same crawl4ai BrowserConfig as main.py.
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from typing import Optional

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
from bs4 import BeautifulSoup

from extractors import OG_PRODUCT_SCHEMA


def _short(s: str, n: int = 140) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[:n] + "…"


def _find_price_nodes(node, path="", out=None, limit=40):
    """Walk a parsed-JSON tree, yield (path, key, value) for price/amount/availability fields."""
    if out is None:
        out = []
    if len(out) >= limit:
        return out
    if isinstance(node, dict):
        for k, v in node.items():
            p = f"{path}.{k}" if path else k
            kl = k.lower()
            if isinstance(v, (str, int, float, bool)) and any(
                t in kl for t in ("price", "amount", "availability", "currency", "sold", "soldout", "available")
            ):
                out.append((p, k, v))
                if len(out) >= limit:
                    return out
            _find_price_nodes(v, p, out, limit)
    elif isinstance(node, list):
        for i, item in enumerate(node):
            _find_price_nodes(item, f"{path}[{i}]", out, limit)
    return out


def dump(html: str, raw_html: str, url: str) -> None:
    soup = BeautifulSoup(html, "lxml")
    raw_soup = BeautifulSoup(raw_html, "lxml") if raw_html and raw_html != html else soup

    print(f"\n{'='*80}\nURL: {url}\nHTML length: {len(html):,} (raw: {len(raw_html):,})\n{'='*80}")

    # ── Meta tags ─────────────────────────────────────────────────────────
    print("\n-- META TAGS (price/og/product) --")
    for m in soup.find_all("meta"):
        key = m.get("property") or m.get("name") or m.get("itemprop") or ""
        if not key:
            continue
        kl = key.lower()
        if any(t in kl for t in ("price", "og:", "product:", "availability", "currency")):
            content = m.get("content", "")
            print(f"  {key} = {_short(content, 120)}")

    # ── JSON-LD ──────────────────────────────────────────────────────────
    print("\n-- JSON-LD blocks --")
    for i, tag in enumerate(soup.find_all("script", type="application/ld+json")):
        try:
            data = json.loads(tag.string or "")
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] (unparseable: {exc})")
            continue
        # Recursively find price-bearing nodes
        flat = []

        def walk(node, path=""):
            if isinstance(node, dict):
                for k, v in node.items():
                    p = f"{path}.{k}" if path else k
                    kl = k.lower()
                    if any(t in kl for t in ("price", "offer", "@type", "availability", "currency")):
                        if isinstance(v, (str, int, float, bool)):
                            flat.append((p, v))
                    walk(v, p)
            elif isinstance(node, list):
                for j, item in enumerate(node):
                    walk(item, f"{path}[{j}]")

        walk(data)
        if flat:
            print(f"  [{i}]")
            for p, v in flat[:25]:
                print(f"    {p} = {_short(str(v), 100)}")

    # ── Visible $-adjacent text ──────────────────────────────────────────
    print("\n-- VISIBLE $-adjacent text (first 12) --")
    text = soup.get_text(" ", strip=True)
    seen = 0
    for m in re.finditer(r"[\$£€]\s?\d[\d,]*(?:\.\d{1,2})?", text):
        start = max(0, m.start() - 35)
        end = min(len(text), m.end() + 35)
        ctx = text[start:end]
        print(f"  {m.group(0):<10}  …{_short(ctx, 120)}…")
        seen += 1
        if seen >= 12:
            break

    # ── __NEXT_DATA__ / inline JSON blobs (use RAW html — not cleaned) ──
    print("\n-- __NEXT_DATA__ / inline JSON (RAW html) --")
    next_data = raw_soup.find("script", id="__NEXT_DATA__")
    if next_data and next_data.string:
        try:
            nd = json.loads(next_data.string)
            hits = _find_price_nodes(nd)
            print(f"  __NEXT_DATA__: {len(hits)} price-like fields")
            for p, k, v in hits[:30]:
                print(f"    {p} = {_short(str(v), 100)}")
        except Exception as exc:  # noqa: BLE001
            print(f"  __NEXT_DATA__ parse failed: {exc}")
    else:
        print("  (no <script id='__NEXT_DATA__'>)")

    # Try Apollo / window.__INITIAL_STATE__ / __APOLLO_STATE__ style inline scripts
    print("\n-- Other inline scripts with 'price' (RAW html, first 8 matches) --")
    seen_scripts = 0
    for tag in raw_soup.find_all("script"):
        if tag.get("id") == "__NEXT_DATA__" or tag.get("type") == "application/ld+json":
            continue
        body = tag.string or tag.text or ""
        if not body or len(body) < 100:
            continue
        if '"price"' not in body.lower() and 'amount' not in body.lower():
            continue
        # Find a JSON object substring around the first price token
        idx = body.lower().find('"price"')
        if idx < 0:
            idx = body.lower().find('amount')
        ctx_start = max(0, idx - 80)
        ctx_end = min(len(body), idx + 200)
        print(f"  [script {seen_scripts}] …{_short(body[ctx_start:ctx_end], 240)}…")
        seen_scripts += 1
        if seen_scripts >= 8:
            break

    # ── What our schema would return ─────────────────────────────────────
    print("\n-- OG_PRODUCT_SCHEMA extraction --")
    try:
        strategy = JsonCssExtractionStrategy(schema=OG_PRODUCT_SCHEMA)
        items = strategy.run(url=url, sections=[html])
        for it in items[:3]:
            print(f"  {json.dumps(it, indent=2)}")
    except Exception as exc:  # noqa: BLE001
        print(f"  (schema error: {exc})")


import hashlib, os as _os


async def probe(urls: list[str]) -> None:
    cfg = BrowserConfig(headless=True, verbose=False, enable_stealth=True, user_agent_mode="random")
    out_dir = _os.path.join(_os.path.dirname(__file__), "debug_dumps")
    _os.makedirs(out_dir, exist_ok=True)
    async with AsyncWebCrawler(config=cfg) as crawler:
        for url in urls:
            run_cfg = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                page_timeout=60_000,
                wait_until="domcontentloaded",
                delay_before_return_html=6.0,
                remove_overlay_elements=False,
                remove_consent_popups=True,
            )
            result = await crawler.arun(url=url, config=run_cfg)
            if not result.success:
                print(f"\nFAILED {url}: {result.error_message}")
                continue
            cleaned = getattr(result, "cleaned_html", "") or ""
            raw = getattr(result, "html", "") or ""
            slug = hashlib.md5(url.encode()).hexdigest()[:10]
            path = _os.path.join(out_dir, f"{slug}.html")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(raw or cleaned)
            print(f"\n[saved raw HTML → {path}]")
            dump(cleaned or raw, raw or cleaned, url)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python debug_probe.py <url> [<url> ...]")
        sys.exit(1)
    asyncio.run(probe(sys.argv[1:]))
