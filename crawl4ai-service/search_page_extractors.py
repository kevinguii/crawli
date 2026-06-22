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
from urllib.parse import quote, urljoin, urlparse, urlunparse

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
        # Strip tracking params — they cause a server-side redirect on load
        # which races with Playwright's Page.content() call.
        clean_href = urlunparse(urlparse(href)._replace(query="", fragment=""))
        sku_to_url[sku] = urljoin(THREDUP_BASE, clean_href)

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

        # Verified live 2026-06-21: every Product node in this JSON-LD array
        # carries a direct top-level "color" string (e.g. "Black") — no
        # additionalProperty lookup needed here, unlike per-listing pages.
        color_raw = p.get("color")
        color = color_raw.strip() if isinstance(color_raw, str) and color_raw.strip() else None

        # Extract brand.name from JSON-LD (format: {"@type": "Brand", "name": "..."}).
        brand_raw = p.get("brand")
        brand_name: Optional[str] = None
        if isinstance(brand_raw, dict):
            brand_name = brand_raw.get("name") if isinstance(brand_raw.get("name"), str) else None
        elif isinstance(brand_raw, str):
            brand_name = brand_raw
        # Prepend brand to title so downstream token-matching sees the brand name.
        # Mirrors the same pattern used by the Depop extractor.
        if brand_name and name and brand_name.lower() not in name.lower():
            name = f"{brand_name} {name}"
        elif brand_name and not name:
            name = brand_name

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
            "color": color,
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


# ── Grailed ─────────────────────────────────────────────────────────────────

GRAILED_BASE = "https://www.grailed.com"


def grailed_search_url(query: str) -> str:
    """Build the Grailed onsite search URL for a query.

    Grailed uses `/shop?query=<urlencoded>` (verified 2026-05-22 via probe).
    The page is client-side rendered: empty shell ships, Algolia call hydrates
    the grid ~2s later. crawl4ai must wait for the listing anchors to appear.
    `/search?query=` returns 302 and is not the right path.
    """
    return f"{GRAILED_BASE}/shop?query={quote(query.strip())}"


_GRAILED_PRICE_RE = re.compile(r"[\d,]+(?:\.\d+)?")


def _grailed_parse_price(text) -> Optional[float]:
    if not isinstance(text, str):
        return None
    m = _GRAILED_PRICE_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def extract_grailed_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a Grailed `/shop?query=...` results page.

    Source: DOM cards under `div[class*='UserItem_root']`. Grailed uses CSS
    Modules — class names get hash suffixes that change every deploy, so we
    match on the `UserItem_*` prefix.

    Verified card structure (2026-05-22):
        div[class*='UserItem_root']
          a[href*='/listings/']                          → URL (strip tracking params)
          img[class*='CoverPhoto']                       → imageUrl (src is real, no lazy placeholder)
          p[class*='UserItem_designer']                  → brand (e.g. "Nike") — informational only
          p[class*='UserItem_size']                      → size (e.g. "xl")
          span[class*='UserItem_title']                  → title
          span[class*='Money_root'][data-testid='Current'] → price (e.g. "$20")

    The `/shop?query=` page is filtered to active listings by default — no
    "Sold" badges observed across 40 probed cards. We set isSold=False
    universally; if Grailed later surfaces sold items here, the badge div
    `div[class*='UserItem_badge']` would carry the indicator.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select("div[class*='UserItem_root']")
    if not cards:
        log.warning("[grailed-grid] no UserItem_root cards found — page may not have rendered")
        return []

    results: list[dict] = []
    for card in cards:
        a = card.select_one("a[href*='/listings/']")
        if not a:
            continue
        href = a.get("href")
        if not isinstance(href, str):
            continue
        # Strip Algolia tracking params (g_aidx, g_aqid) — same redirect-on-load
        # issue ThredUp had. The canonical path is /listings/<id>-<slug>.
        clean_href = urlunparse(urlparse(href)._replace(query="", fragment=""))
        url = urljoin(GRAILED_BASE, clean_href)

        title_el = card.select_one("span[class*='UserItem_title']")
        title = title_el.get_text(strip=True) if title_el else None
        if isinstance(title, str):
            title = html_module.unescape(title)

        price_el = (
            card.select_one("[data-testid='Current']")
            or card.select_one("span[class*='Money_root']")
        )
        price = _grailed_parse_price(price_el.get_text(strip=True) if price_el else "")

        size_el = card.select_one("p[class*='UserItem_size']")
        size = size_el.get_text(strip=True) if size_el else None

        img_el = card.select_one("img[class*='CoverPhoto']") or card.select_one("img")
        image = img_el.get("src") if img_el else None

        results.append({
            "url": url,
            "title": title,
            "price": price,
            "currency": "USD",
            "isSold": False,
            "condition": None,
            "imageUrl": image,
            "size": size,
        })

        if len(results) >= limit:
            break

    log.info("[grailed-grid] extracted %d listings (out of %d cards)", len(results), len(cards))
    return results


# ── Mercari ─────────────────────────────────────────────────────────────────

MERCARI_BASE = "https://www.mercari.com"

_MERCARI_PRICE_RE = re.compile(r"\$([\d,]+(?:\.\d+)?)")


def mercari_search_url(query: str) -> str:
    """Build the Mercari US onsite search URL.

    Verified 2026-05-27 via probe: `/search/?keyword=<urlencoded>` returns 200
    with the listing grid hydrated into the DOM (the page is client-side
    rendered — __NEXT_DATA__ is essentially empty here, unlike item-detail
    pages). Each card is a `div[data-testid='ItemContainer']`.
    """
    return f"{MERCARI_BASE}/search/?keyword={quote(query.strip())}"


def extract_mercari_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a Mercari `/search/?keyword=...` results page.

    Source: DOM cards under `div[data-testid='ItemContainer']`. The card root
    carries clean data attributes (`data-productid`, `data-size`, `data-brand`,
    `data-is-on-sale`); inner testids carry the title and price text:

        div[data-testid='ItemContainer']
          @data-productid                              → item id (URL is
                                                          /us/item/<id>/)
          @data-size                                   → size (e.g. "S (34-36)")
          @data-brand                                  → brand (informational)
          @data-is-on-sale                             → "true" / "false"
          [data-testid='ItemName']                     → title
          [data-testid='ProductThumbItemPrice']        → price text. When on
                                                          sale, reads "$X$Y"
                                                          (current $X, original
                                                          $Y) — take the first
                                                          $ amount as current.
          img                                          → imageUrl (cdn host
                                                          u-mercari-images.mercdn.net)

    Mercari's search default excludes sold listings (verified 2026-05-27
    against a typical query — all 35 cards had data-is-on-sale="true" and no
    SOLD badge). We set isSold=False; if Mercari surfaces sold cards here
    later, look for a `SOLD` text badge inside the card.

    URL is constructed from data-productid: there is no anchor inside the
    card itself (Mercari wraps the grid with a click handler), so we rebuild
    `/us/item/<productid>/`.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select("[data-testid='ItemContainer']")
    if not cards:
        log.warning("[mercari-grid] no ItemContainer cards found — page may not have rendered")
        return []

    results: list[dict] = []
    for card in cards:
        product_id = card.get("data-productid")
        if not isinstance(product_id, str) or not product_id:
            continue
        url = f"{MERCARI_BASE}/us/item/{product_id}/"

        title_el = card.select_one("[data-testid='ItemName']")
        title = title_el.get_text(strip=True) if title_el else None
        if isinstance(title, str):
            title = html_module.unescape(title)

        price_el = card.select_one("[data-testid='ProductThumbItemPrice']")
        price: Optional[float] = None
        if price_el:
            m = _MERCARI_PRICE_RE.search(price_el.get_text(strip=True))
            if m:
                try:
                    price = float(m.group(1).replace(",", ""))
                except ValueError:
                    price = None

        size = card.get("data-size") if isinstance(card.get("data-size"), str) else None

        img_el = card.find("img")
        image = img_el.get("src") if img_el else None
        # Skip SVG-only placeholders (e.g. lazy-load shells) — real Mercari
        # photos are on the mercdn.net CDN.
        if isinstance(image, str) and image.startswith("data:"):
            image = None

        results.append({
            "url": url,
            "title": title,
            "price": price,
            "currency": "USD",  # mercari.com/us is USD-only
            "isSold": False,
            "condition": None,
            "imageUrl": image,
            "size": size,
        })

        if len(results) >= limit:
            break

    log.info("[mercari-grid] extracted %d listings (out of %d cards)", len(results), len(cards))
    return results


# ── Depop ───────────────────────────────────────────────────────────────────

DEPOP_BASE = "https://www.depop.com"

_DEPOP_PRICE_RE = re.compile(r"\$([\d,]+(?:\.\d+)?)")
# Depop product slugs end in a short alphanumeric id, e.g. .../<seller>-<words>-2963/
# We treat that trailing token as the hash and the FIRST token as the seller
# username (Depop usernames may contain underscores/digits but generally not
# hyphens — see comment in _depop_title_from_slug).
_DEPOP_SLUG_TAIL = re.compile(r"-[a-z0-9]{3,6}/?$", re.IGNORECASE)


def depop_search_url(query: str) -> str:
    """Build the Depop onsite search URL.

    Verified 2026-05-27 via probe: `/search/?q=<urlencoded>` returns 200 with
    the listing grid rendered into the DOM (no __NEXT_DATA__, no JSON-LD —
    pure DOM cards). 24 cards per page on a typical query.
    """
    return f"{DEPOP_BASE}/search/?q={quote(query.strip())}"


def _depop_title_from_slug(href: str) -> Optional[str]:
    """Synthesise a title from a Depop product URL slug.

    Depop search cards carry no title text — only brand + size + price are
    rendered (verified 2026-05-27: img alt is empty, anchor aria-label is
    empty, no title <p>). The URL slug shape is:

        /products/<seller>-<descriptor-words>-<3-6charhash>/

    Strategy: strip the trailing 3-6 char alphanumeric hash and the leading
    seller username token, then dehyphenate. Depop usernames may contain
    underscores and digits (e.g. `zaydh_156`) but as of 2026-05-27 we have
    not seen one with a hyphen on a search results page. If a hyphenated
    username appears, the leading word of the resulting title gets eaten —
    not ideal but the brand field still carries the canonical brand text.

    Examples:
        /products/dpantsu-fear-of-god-essentials-black-2963/
            → "fear of god essentials black"
        /products/zaydh_156-fear-of-god-essentials-black-a5e3/
            → "fear of god essentials black"
    """
    if not isinstance(href, str) or "/products/" not in href:
        return None
    slug = href.split("/products/", 1)[1].rstrip("/")
    if not slug:
        return None
    # Drop trailing hash.
    slug = _DEPOP_SLUG_TAIL.sub("", slug)
    parts = slug.split("-")
    # Drop the seller token (first one).
    if len(parts) > 1:
        parts = parts[1:]
    title = " ".join(parts).strip()
    return title or None


def extract_depop_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a Depop `/search/?q=...` results page.

    Source: DOM cards under `div[class*='styles_productCardRoot']`. Depop uses
    CSS Modules — class names get hash suffixes that change every deploy —
    so we match on the prefix and use `aria-description` on price elements
    (stable accessibility attribute) to disambiguate sale prices.

    Verified card structure (2026-05-27, dump in debug_dumps/):
        div[class*='styles_productCardRoot']
          a[href*='/products/']                              → URL (relative)
          img[class*='_mainImage']                           → imageUrl (src)
          div[class*='styles_productAttributes']
            p[class*='styles_brandName']                     → brand (e.g. "Fear of God")
            p[class*='styles_sizeAttributeText']             → size (e.g. "S", "XL")
            p[aria-description='Price']                      → current price (no sale)
            p[aria-description='Discounted price']           → current price (sale)
            p[aria-description='Full price']                 → original price (strikethrough; ignore)

    Title: Depop search cards genuinely have no title field — img alt is
    empty, anchor aria-label is empty, no title <p>. We synthesise from the
    URL slug (see _depop_title_from_slug). The brand text is also captured
    separately for callers that need it.

    Sold: not observed on the search-results page (Depop search default
    excludes sold items, verified across 24 cards). Set isSold=False.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select("div[class*='styles_productCardRoot']")
    if not cards:
        log.warning("[depop-grid] no productCardRoot cards found — page may not have rendered")
        return []

    results: list[dict] = []
    for card in cards:
        a = card.find("a", href=True)
        if not a:
            continue
        href = a.get("href")
        if not isinstance(href, str) or "/products/" not in href:
            continue
        url = urljoin(DEPOP_BASE, href)

        # Price — prefer Discounted (current) over Price (no-sale); skip Full price.
        price_el = (
            card.select_one("p[aria-description='Discounted price']")
            or card.select_one("p[aria-description='Price']")
        )
        price: Optional[float] = None
        if price_el:
            m = _DEPOP_PRICE_RE.search(price_el.get_text(strip=True))
            if m:
                try:
                    price = float(m.group(1).replace(",", ""))
                except ValueError:
                    price = None

        brand_el = card.select_one("p[class*='styles_brandName']")
        brand = brand_el.get_text(strip=True) if brand_el else None

        size_el = card.select_one("p[class*='styles_sizeAttributeText']")
        size = size_el.get_text(strip=True) if size_el else None

        img_el = card.select_one("img[class*='_mainImage']") or card.find("img")
        image = img_el.get("src") if img_el else None
        if isinstance(image, str) and image.startswith("data:"):
            image = None

        title = _depop_title_from_slug(href)
        # Prepend brand if we have one and it's not already in the title.
        if brand and title and brand.lower() not in title.lower():
            title = f"{brand} {title}"
        elif brand and not title:
            title = brand

        results.append({
            "url": url,
            "title": title,
            "price": price,
            "currency": "USD",  # depop.com is multi-region; US site is USD. Depop ships USD
                                 # when the geo-detected region is US — same assumption the
                                 # existing per-listing extractor makes.
            "isSold": False,
            "condition": None,
            "imageUrl": image,
            "size": size,
        })

        if len(results) >= limit:
            break

    log.info("[depop-grid] extracted %d listings (out of %d cards)", len(results), len(cards))
    return results


# ── Dispatch ────────────────────────────────────────────────────────────────

SEARCH_PAGE_PLATFORMS = {"thredup", "realreal", "grailed", "mercari", "depop"}


def search_url_for(platform: str, query: str) -> Optional[str]:
    if platform == "thredup":
        return thredup_search_url(query)
    if platform == "realreal":
        return therealreal_search_url(query)
    if platform == "grailed":
        return grailed_search_url(query)
    if platform == "mercari":
        return mercari_search_url(query)
    if platform == "depop":
        return depop_search_url(query)
    return None


def extract_search_grid(platform: str, html: str, *, limit: int = 24) -> list[dict]:
    if platform == "thredup":
        return extract_thredup_grid(html, limit=limit)
    if platform == "realreal":
        return extract_therealreal_grid(html, limit=limit)
    if platform == "grailed":
        return extract_grailed_grid(html, limit=limit)
    if platform == "mercari":
        return extract_mercari_grid(html, limit=limit)
    if platform == "depop":
        return extract_depop_grid(html, limit=limit)
    return []
