"""Per-platform search-page (grid) extractors.

Some platforms (ThredUp, and likely Vestiaire if we revisit it) don't expose
individual listing URLs via Firecrawl's `site:` search. For those platforms we
build the platform's own search URL, render it once, and pull a grid of
listings out of the resulting page.

Each extractor returns a list of dicts shaped like the canonical ScrapedListing
+ a required `url` field. main.py wraps them as ScrapedListing models.
"""
from __future__ import annotations

import html as html_module
import json
import logging
import re
from typing import Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

log = logging.getLogger("crawl4ai-sidecar")


# ── ThredUp ─────────────────────────────────────────────────────────────────

THREDUP_BASE = "https://www.thredup.com"


def thredup_search_url(query: str) -> str:
    """Build the ThredUp onsite search URL for a query.

    ThredUp uses `/search/<hyphen-slug>` where the slug is the query with
    spaces → hyphens, lower-cased. Special chars get URL-encoded by quote().
    Verified path shape: /search/nike-air-jordan-1, /search/blue-jeans, etc.
    """
    slug = re.sub(r"\s+", "-", query.strip().lower())
    return f"{THREDUP_BASE}/search/{quote(slug, safe='-')}"


def _thredup_condition_label(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    v = value.lower()
    if "new" in v:
        return "New"
    if "used" in v:
        return "Used"
    if "refurbished" in v:
        return "Refurbished"
    return None


def _thredup_availability_is_sold(value) -> bool:
    if not isinstance(value, str):
        return False
    v = value.lower().replace("https://", "").replace("http://", "").replace("schema.org/", "")
    return "soldout" in v.replace(" ", "").replace("_", "") or "outofstock" in v.replace(" ", "").replace("_", "")


def extract_thredup_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract up to `limit` listings from a ThredUp search-results page.

    Source: a single <script type="application/ld+json"> with an array of
    @type=Product objects (verified 2026-05-18: 119 products per page for a
    typical query). Per-product fields used: name, sku, image[0], offers.price,
    offers.priceCurrency, offers.itemCondition, offers.availability.

    URL is reconstructed from the DOM: each card is wrapped in
    <div class="item-card" data-item-number="<sku>"> containing
    <a data-inp-label="link-item-card" href="/product/<slug>/<sku>?...">.
    JSON-LD does not carry the URL itself, so the SKU→href map is required.

    Returns a list of dicts; each dict has shape:
        { url, title, price, currency, isSold, condition, imageUrl }
    Sold items pass through unchanged — caller applies the same filter the
    rest of the pipeline applies to single-listing scrapes (parseScrapedListings
    drops s.isSold === true).
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    # Build SKU → absolute URL map from DOM.
    sku_to_url: dict[str, str] = {}
    for a in soup.find_all("a", attrs={"data-inp-label": "link-item-card"}):
        href = a.get("href")
        if not isinstance(href, str) or "/product/" not in href:
            continue
        # /product/<slug>/<sku>?query_id=...&result_id=...
        m = re.search(r"/product/[^/?#]+/(\d+)", href)
        if not m:
            continue
        sku = m.group(1)
        if sku in sku_to_url:
            continue  # the DOM has two anchors per card; keep the first
        sku_to_url[sku] = urljoin(THREDUP_BASE, href)

    # Find the product-array JSON-LD block.
    products: list[dict] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        body = tag.string or tag.text
        if not body:
            continue
        try:
            data = json.loads(body)
        except Exception:  # noqa: BLE001
            continue
        if not isinstance(data, list):
            continue
        for node in data:
            if isinstance(node, dict) and isinstance(node.get("@type"), str) and node["@type"].lower() == "product":
                products.append(node)
        # First matching block is the right one (the other block is
        # SoftwareApplication / aggregateRating noise).
        if products:
            break

    if not products:
        log.warning("[thredup-grid] no Product JSON-LD found")
        return []

    results: list[dict] = []
    for p in products:
        sku = p.get("sku")
        if not isinstance(sku, str):
            continue
        url = sku_to_url.get(sku)
        if not url:
            # JSON-LD product without a matching DOM card — skip rather than
            # synthesize a URL (the slug isn't in JSON-LD).
            continue

        offer = p.get("offers")
        if not isinstance(offer, dict):
            offer = {}
        price = offer.get("price")
        currency = offer.get("priceCurrency") if isinstance(offer.get("priceCurrency"), str) else "USD"
        availability = offer.get("availability")
        condition_raw = offer.get("itemCondition")

        name = p.get("name")
        if isinstance(name, str):
            name = html_module.unescape(name)

        image = None
        img_field = p.get("image")
        if isinstance(img_field, list) and img_field:
            first = img_field[0]
            if isinstance(first, str):
                image = first
            elif isinstance(first, dict):
                image = first.get("url") or first.get("@id")
        elif isinstance(img_field, str):
            image = img_field

        results.append({
            "url": url,
            "title": name,
            "price": price,
            "currency": currency,
            "isSold": _thredup_availability_is_sold(availability),
            "condition": _thredup_condition_label(condition_raw),
            "imageUrl": image,
        })

        if len(results) >= limit:
            break

    log.info("[thredup-grid] extracted %d listings (out of %d products in JSON-LD)", len(results), len(products))
    return results


# ── Dispatch ────────────────────────────────────────────────────────────────

SEARCH_PAGE_PLATFORMS = {"thredup"}


def search_url_for(platform: str, query: str) -> Optional[str]:
    if platform == "thredup":
        return thredup_search_url(query)
    return None


def extract_search_grid(platform: str, html: str, *, limit: int = 24) -> list[dict]:
    if platform == "thredup":
        return extract_thredup_grid(html, limit=limit)
    return []
