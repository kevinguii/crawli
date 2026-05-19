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


# ── The RealReal ────────────────────────────────────────────────────────────

THEREALREAL_BASE = "https://www.therealreal.com"


def therealreal_search_url(query: str) -> str:
    """Build the TRR search URL.

    TRR uses `/products?keywords=<urlencoded>` (verified 2026-05-19). The
    `/shop/all?keywords=` path silently ignores the keywords param and returns
    a generic feed, so this is the only working search URL.
    """
    return f"{THEREALREAL_BASE}/products?keywords={quote(query.strip())}"


def _therealreal_availability_is_sold(value) -> bool:
    if not isinstance(value, str):
        return False
    v = value.upper()
    # AVAILABLE is in-stock; SOLD / SOLD_OUT / UNAVAILABLE / OUT_OF_STOCK signal sold.
    return v != "AVAILABLE" and any(t in v for t in ("SOLD", "OUT", "UNAVAILABLE"))


def extract_therealreal_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a TRR search-results page.

    Source: `__NEXT_DATA__.props.pageProps.serverResult.data.products.edges`
    (a Relay-style GraphQL response embedded in the SSR payload). Each edge's
    node carries name, url (absolute), price.final.usdCents (price in cents),
    availability, images[0].url.

    Falls back to empty list if the GraphQL block is absent — likely indicates
    PerimeterX captcha page (no __NEXT_DATA__) or expired session.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    nd = soup.find("script", id="__NEXT_DATA__")
    if not nd or not (nd.string or nd.text):
        log.warning("[therealreal-grid] __NEXT_DATA__ missing — likely PX challenge page")
        return []
    try:
        nd_data = json.loads(nd.string or nd.text)
    except Exception as exc:  # noqa: BLE001
        log.warning("[therealreal-grid] __NEXT_DATA__ parse failed: %s", exc)
        return []

    try:
        edges = (
            nd_data["props"]["pageProps"]["serverResult"]["data"]["products"]["edges"]
        )
    except (KeyError, TypeError):
        log.warning("[therealreal-grid] serverResult.data.products.edges missing")
        return []
    if not isinstance(edges, list):
        return []

    results: list[dict] = []
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        node = edge.get("node")
        if not isinstance(node, dict):
            continue

        url = node.get("url")
        if not isinstance(url, str):
            continue

        name = node.get("name") if isinstance(node.get("name"), str) else None
        if isinstance(name, str):
            name = html_module.unescape(name)

        # Price: prefer final.usdCents (cents → divide by 100). Fall back to
        # final.formatted parse if cents missing.
        price = None
        currency = "USD"
        price_block = node.get("price")
        if isinstance(price_block, dict):
            final = price_block.get("final")
            if isinstance(final, dict):
                cents = final.get("usdCents")
                if isinstance(cents, (int, float)) and cents > 0:
                    price = float(cents) / 100.0
                elif isinstance(final.get("formatted"), str):
                    # "$316.00" → 316.00
                    m = re.search(r"[\d,]+(?:\.\d+)?", final["formatted"])
                    if m:
                        try:
                            price = float(m.group(0).replace(",", ""))
                        except ValueError:
                            pass

        image = None
        images = node.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict):
                image = first.get("url")
            elif isinstance(first, str):
                image = first

        results.append({
            "url": url,
            "title": name,
            "price": price,
            "currency": currency,
            "isSold": _therealreal_availability_is_sold(node.get("availability")),
            "condition": "Used",  # TRR is exclusively pre-owned consignment
            "imageUrl": image,
        })

        if len(results) >= limit:
            break

    log.info("[therealreal-grid] extracted %d listings (out of %d edges)", len(results), len(edges))
    return results


# ── Dispatch ────────────────────────────────────────────────────────────────

SEARCH_PAGE_PLATFORMS = {"thredup", "realreal"}


def search_url_for(platform: str, query: str) -> Optional[str]:
    if platform == "thredup":
        return thredup_search_url(query)
    if platform == "realreal":
        return therealreal_search_url(query)
    return None


def extract_search_grid(platform: str, html: str, *, limit: int = 24) -> list[dict]:
    if platform == "thredup":
        return extract_thredup_grid(html, limit=limit)
    if platform == "realreal":
        return extract_therealreal_grid(html, limit=limit)
    return []
