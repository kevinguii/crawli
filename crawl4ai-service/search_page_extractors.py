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
    Sold items pass through unchanged, caller applies the same filter the
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
        # Strip tracking params: they cause a server-side redirect on load
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
            # JSON-LD product without a matching DOM card, skip rather than
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
        # carries a direct top-level "color" string (e.g. "Black"), no
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
        # MUST unescape before the containment check below. ThredUp ships the
        # brand HTML-escaped ("Levi&apos;s") while `name` is already unescaped
        # ("Levi's Blue Jeans Size 36 waist"), so the raw comparison never
        # matched and every apostrophe brand got its escaped form prepended to
        # a title that already contained it: "Levi&apos;s Levi's Blue Jeans".
        # Measured 2026-08-25 on `levis 501 jeans`: 85 of 100 rows affected,
        # entity visible verbatim in the results UI.
        if isinstance(brand_name, str):
            brand_name = html_module.unescape(brand_name).strip() or None
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

    Falls back to empty list if the GraphQL block is absent, likely indicates
    PerimeterX captcha page (no __NEXT_DATA__) or expired session.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    nd = soup.find("script", id="__NEXT_DATA__")
    if not nd or not (nd.string or nd.text):
        log.warning("[therealreal-grid] __NEXT_DATA__ missing, likely PX challenge page")
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
    Modules: class names get hash suffixes that change every deploy, so we
    match on the `UserItem_*` prefix.

    Verified card structure (2026-05-22):
        div[class*='UserItem_root']
          a[href*='/listings/']                          → URL (strip tracking params)
          img[class*='CoverPhoto']                       → imageUrl (src is real, no lazy placeholder)
          p[class*='UserItem_designer']                  → brand (e.g. "Nike"), informational only
          p[class*='UserItem_size']                      → size (e.g. "xl")
          span[class*='UserItem_title']                  → title
          span[class*='Money_root'][data-testid='Current'] → price (e.g. "$20")

    The `/shop?query=` page is filtered to active listings by default: no
    "Sold" badges observed across 40 probed cards. We set isSold=False
    universally; if Grailed later surfaces sold items here, the badge div
    `div[class*='UserItem_badge']` would carry the indicator.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select("div[class*='UserItem_root']")
    if not cards:
        log.warning("[grailed-grid] no UserItem_root cards found, page may not have rendered")
        return []

    results: list[dict] = []
    for card in cards:
        a = card.select_one("a[href*='/listings/']")
        if not a:
            continue
        href = a.get("href")
        if not isinstance(href, str):
            continue
        # Strip Algolia tracking params (g_aidx, g_aqid), same redirect-on-load
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
    rendered: __NEXT_DATA__ is essentially empty here, unlike item-detail
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
                                                          $Y), take the first
                                                          $ amount as current.
          img                                          → imageUrl (cdn host
                                                          u-mercari-images.mercdn.net)

    Mercari's search default excludes sold listings (verified 2026-05-27
    against a typical query, all 35 cards had data-is-on-sale="true" and no
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
        log.warning("[mercari-grid] no ItemContainer cards found, page may not have rendered")
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
        # Skip SVG-only placeholders (e.g. lazy-load shells), real Mercari
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
# hyphens, see comment in _depop_title_from_slug).
_DEPOP_SLUG_TAIL = re.compile(r"-[a-z0-9]{3,6}/?$", re.IGNORECASE)


def depop_search_url(query: str) -> str:
    """Build the Depop onsite search URL.

    Verified 2026-05-27 via probe: `/search/?q=<urlencoded>` returns 200 with
    the listing grid rendered into the DOM (no __NEXT_DATA__, no JSON-LD,
    pure DOM cards). 24 cards per page on a typical query.
    """
    return f"{DEPOP_BASE}/search/?q={quote(query.strip())}"


def _depop_title_from_slug(href: str) -> Optional[str]:
    """Synthesise a title from a Depop product URL slug.

    Depop search cards carry no title text: only brand + size + price are
    rendered (verified 2026-05-27: img alt is empty, anchor aria-label is
    empty, no title <p>). The URL slug shape is:

        /products/<seller>-<descriptor-words>-<3-6charhash>/

    Strategy: strip the trailing 3-6 char alphanumeric hash and the leading
    seller username token, then dehyphenate. Depop usernames may contain
    underscores and digits (e.g. `zaydh_156`) but as of 2026-05-27 we have
    not seen one with a hyphen on a search results page. If a hyphenated
    username appears, the leading word of the resulting title gets eaten,
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

    Source: DOM cards under `div[class*='productCardRoot']`. Depop uses CSS
    Modules: class names get a scoping prefix/hash that changes across
    deploys, so we match on the semantic suffix only, not any particular
    prefix, and use `aria-description` on price elements (stable
    accessibility attribute) to disambiguate sale prices.

    Verified card structure (2026-05-27, dump in debug_dumps/):
        div[class*='productCardRoot']
          a[href*='/products/']                              → URL (relative)
          img[class*='_mainImage']                           → imageUrl (src)
          div[class*='productAttributes']
            p[class*='brandName']                            → brand (e.g. "Fear of God")
            p[class*='sizeAttributeText']                    → size (e.g. "S", "XL")
            p[aria-description='Price']                      → current price (no sale)
            p[aria-description='Discounted price']           → current price (sale)
            p[aria-description='Full price']                 → original price (strikethrough; ignore)

    Class-name prefix rotated 2026-08-15: Depop shipped a build where the
    old `styles_productCardRoot__<hash>` (and sibling `styles_brandName`,
    `styles_sizeAttributeText`) scoping changed to
    `styles-module__<hash>__productCardRoot`, a different hash *position*
    relative to the semantic name, not just a different hash value. Matching
    on the bare prefix (`styles_...`) silently returned 0 cards despite a
    fully-rendered, 200 OK page with real listings still present (24 intact
    `/products/` links, just not wrapped in a div our old selector matched),
    see PITFALLS.md "Depop CSS Modules prefix rotation". Selectors below
    intentionally drop the `styles_`/`styles-module__` prefix and match only
    on the semantic suffix, since that's the part Depop's own markup keeps
    stable across rebuilds; re-verify this docstring's structure dump if
    extraction silently drops to 0 again.

    Title: Depop search cards genuinely have no title field, img alt is
    empty, anchor aria-label is empty, no title <p>. We synthesise from the
    URL slug (see _depop_title_from_slug). The brand text is also captured
    separately for callers that need it.

    Sold: not observed on the search-results page (Depop search default
    excludes sold items, verified across 24 cards). Set isSold=False.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select("div[class*='productCardRoot']")
    if not cards:
        log.warning("[depop-grid] no productCardRoot cards found, page may not have rendered")
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

        # Price: prefer Discounted (current) over Price (no-sale); skip Full price.
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

        brand_el = card.select_one("p[class*='brandName']")
        brand = brand_el.get_text(strip=True) if brand_el else None

        size_el = card.select_one("p[class*='sizeAttributeText']")
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
                                 # when the geo-detected region is US, same assumption the
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


# ── Vestiaire Collective ─────────────────────────────────────────────────────

VESTIAIRE_BASE = "https://us.vestiairecollective.com"

# Vestiaire ships the brand in ALL CAPS ("LEVI'S", "DOLCE & GABBANA") and we
# title-case it for display. Python's str.title() uppercases the letter after
# ANY non-alpha character, so a possessive apostrophe comes out wrong:
# "LEVI'S".title() == "Levi'S". Measured 2026-08-25: 15 of 15 rows on
# `levis 501 jeans` rendered as "Levi'S 501 straight jeans" in the results UI.
# Same family as the ThredUp "Levi&apos;s" bug, different mechanism.
#
# Repair only a lone trailing S after an apostrophe. Deliberately NOT a blanket
# lowercase-after-apostrophe: str.title() gets "O'Neill" and "L'Occitane"
# RIGHT, and a broader rule would break them back into "O'neill"/"L'occitane".
_TITLECASE_POSSESSIVE_RE = re.compile(r"(['’])S\b")


def _vestiaire_title_case(text: str) -> str:
    return _TITLECASE_POSSESSIVE_RE.sub(lambda m: m.group(1) + "s", text.title())
_VESTIAIRE_PRICE_RE = re.compile(r"\$([\d,]+(?:\.\d+)?)")


def vestiaire_search_url(query: str) -> str:
    """Build the Vestiaire US onsite search URL.

    Vestiaire uses /search/?q=<urlencoded> on the us. subdomain (verified
    2026-06-29 via probe). www. redirects to us. We go direct to skip the
    hop. The page is CSR: products load ~9s after nav via client fetch.
    wait_for: css:a[data-cy^="catalog__productCard__"]
    """
    return f"{VESTIAIRE_BASE}/search/?q={quote(query.strip())}"


def extract_vestiaire_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a Vestiaire /search/?q= page.

    Source: CSR-rendered anchors a[data-cy^="catalog__productCard__"]. The
    page has no product data in __NEXT_DATA__ (empty array), all products
    are fetched client-side after hydration, so caller must wait_for the card
    selector.

    Card anatomy (verified 2026-06-29):
        a[data-cy^="catalog__productCard__"]   → relative href to listing
          [data-cy="productCard__text__brand"]  → brand in ALL-CAPS
          [data-cy="productCard__text__name"]   → item type ("Jeans", "T-shirt")
          [data-cy="productCard__text__size"]   → p with 2 spans:
                                                  span.vc-d-none "Size:" + span with value
          [data-cy="productCard__price"]        → "$161" price text
          img                                   → imageUrl
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select('a[data-cy^="catalog__productCard__"]')
    if not cards:
        log.warning("[vestiaire-grid] no productCard anchors found, page may not have rendered")
        return []

    results: list[dict] = []
    for card in cards:
        href = card.get("href")
        if not isinstance(href, str):
            continue
        url = urljoin(VESTIAIRE_BASE, href)

        brand_el = card.select_one('[data-cy="productCard__text__brand"]')
        brand = _vestiaire_title_case(brand_el.get_text(strip=True)) if brand_el else None

        name_el = card.select_one('[data-cy="productCard__text__name"]')
        name = name_el.get_text(strip=True) if name_el else None

        title = None
        if brand and name:
            title = f"{brand} {name}"
        elif brand:
            title = brand
        elif name:
            title = name

        size_el = card.select_one('[data-cy="productCard__text__size"]')
        size = None
        if size_el:
            spans = size_el.find_all("span")
            raw = (spans[-1].get_text(strip=True) if len(spans) > 1 else size_el.get_text(strip=True))
            raw = raw.replace("\xa0", "").strip()
            size = raw if raw and raw.lower() != "size:" else None

        price_el = card.select_one('[data-cy="productCard__price"]')
        price: Optional[float] = None
        if price_el:
            m = _VESTIAIRE_PRICE_RE.search(price_el.get_text(strip=True))
            if m:
                try:
                    price = float(m.group(1).replace(",", ""))
                except ValueError:
                    pass

        img_el = card.find("img")
        image = img_el.get("src") if img_el else None
        if isinstance(image, str) and image.startswith("data:"):
            image = None

        results.append({
            "url": url,
            "title": title,
            "price": price,
            "currency": "USD",
            "isSold": False,
            "condition": "Used",
            "imageUrl": image,
            "size": size,
        })

        if len(results) >= limit:
            break

    log.info("[vestiaire-grid] extracted %d listings (out of %d cards)", len(results), len(cards))
    return results


# ── Vinted ───────────────────────────────────────────────────────────────────

VINTED_BASE = "https://www.vinted.com"
_VINTED_PRICE_RE = re.compile(r"\$([\d,]+(?:\.\d+)?)")
_VINTED_META_RE = re.compile(
    r"^(.+?),\s*brand:\s*(.+?),\s*condition:\s*(.+?),\s*size:\s*(.+?),", re.IGNORECASE
)


def vinted_search_url(query: str) -> str:
    """Build the Vinted onsite search URL.

    Verified 2026-06-29: /catalog?search_text=<urlencoded> returns the search
    grid. 96 cards present in the initial page render (no wait needed).
    """
    return f"{VINTED_BASE}/catalog?search_text={quote(query.strip())}"


def extract_vinted_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a Vinted /catalog?search_text= page.

    Source: DOM cards under a container whose class contains
    `new-item-box__container`. The overlay anchor's `title` attribute is a
    comma-structured metadata string:
        "Listing title, brand: Brand, condition: Cond, size: Size, $price, ..."
    Used as the primary parse target because it is stable across redesigns.

    Card anatomy (verified 2026-06-29, 96 cards on typical query):
        div[class*='new-item-box__container']
          a[class*='new-item-box__overlay'][href="/items/<id>-<slug>?referrer=catalog"]
            @title → structured metadata string
          [data-testid$="--price-text"]     → "$35.00" price element

    Class-name matching is substring-based, not an exact token/dot selector
    (found 2026-08-15, same root cause as Depop's rotation, see PITFALLS.md
    "Depop CSS Modules prefix rotation"): Vinted's build now glues a scoping
    prefix directly onto the semantic name with no separating space,
    `class="ItemBox-module-scss-module__NoC3Da__new-item-box__container"` is
    a single class *token*, so a `div.new-item-box__container` dot-selector
    (exact-token match) stopped matching even though the substring is right
    there in the attribute. `[class*=...]` matches raw substrings within the
    whole class attribute regardless of token boundaries, so it survives
    both this "glued, no space" rotation and Depop's "different prefix
    entirely" rotation.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    containers = soup.select("div[class*='new-item-box__container']")
    if not containers:
        log.warning("[vinted-grid] no new-item-box__container cards found")
        return []

    results: list[dict] = []
    for container in containers:
        overlay = container.select_one("a[class*='new-item-box__overlay']")
        if not overlay:
            continue
        href = overlay.get("href", "")
        if not href:
            continue
        url = urljoin(VINTED_BASE, href.split("?")[0])

        title_attr = overlay.get("title", "")
        listing_title: Optional[str] = None
        condition: Optional[str] = None
        size: Optional[str] = None
        m = _VINTED_META_RE.match(title_attr)
        if m:
            listing_title = m.group(1).strip() or None
            condition = m.group(3).strip() or None
            size = m.group(4).strip() or None
        else:
            parts = re.split(r",\s*(?:brand:|condition:|\$)", title_attr)
            listing_title = parts[0].strip() or None

        price_el = container.find(attrs={"data-testid": re.compile(r"--price-text$")})
        price: Optional[float] = None
        if price_el:
            m2 = _VINTED_PRICE_RE.search(price_el.get_text(strip=True))
            if m2:
                try:
                    price = float(m2.group(1).replace(",", ""))
                except ValueError:
                    pass

        img_el = container.find("img")
        image = img_el.get("src") if img_el else None

        results.append({
            "url": url,
            "title": listing_title,
            "price": price,
            "currency": "USD",
            "isSold": False,
            "condition": condition,
            "imageUrl": image,
            "size": size,
        })

        if len(results) >= limit:
            break

    log.info("[vinted-grid] extracted %d listings (out of %d containers)", len(results), len(containers))
    return results


# ── Poshmark ─────────────────────────────────────────────────────────────────

POSHMARK_BASE = "https://poshmark.com"
_POSHMARK_PRICE_RE = re.compile(r"\$([\d,]+(?:\.\d+)?)")


def poshmark_search_url(query: str) -> str:
    """Build the Poshmark search URL for listings.

    Verified 2026-06-29: /search?query=<urlencoded>&type=listings returns the
    listing grid. 96 cards present in the initial render (no JSON-LD).
    """
    return f"{POSHMARK_BASE}/search?query={quote(query.strip())}&type=listings"


def extract_poshmark_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a Poshmark /search?type=listings page.

    Source: DOM cards under div.tile-grid-redesign__media--wrapper. Each
    wrapper contains two anchors: the image anchor (tile__covershot) and the
    meta anchor (tile-grid-redesign__meta-link). No JSON-LD on search pages.

    Card anatomy (verified 2026-06-29):
        div.tile-grid-redesign__media--wrapper
          a.tile__covershot                           → img (imageUrl)
          a.tile-grid-redesign__meta-link[href="/listing/<id>"]
            span.tile-grid-redesign__title            → title
            span.tile-grid-redesign__price-current    → "$8"
            div.tile-grid-redesign__size              → "OS", "M", etc.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    wrappers = soup.select("div.tile-grid-redesign__media--wrapper")
    if not wrappers:
        log.warning("[poshmark-grid] no tile-grid-redesign__media--wrapper cards found")
        return []

    results: list[dict] = []
    for wrapper in wrappers:
        meta_link = wrapper.select_one("a.tile-grid-redesign__meta-link")
        if not meta_link:
            continue
        href = meta_link.get("href", "")
        if not href or "/listing/" not in href:
            continue
        url = urljoin(POSHMARK_BASE, href)

        title_el = meta_link.select_one("span.tile-grid-redesign__title")
        title = title_el.get_text(strip=True) if title_el else None

        price_el = meta_link.select_one("span.tile-grid-redesign__price-current")
        price: Optional[float] = None
        if price_el:
            m = _POSHMARK_PRICE_RE.search(price_el.get_text(strip=True))
            if m:
                try:
                    price = float(m.group(1).replace(",", ""))
                except ValueError:
                    pass

        size_el = meta_link.select_one("div.tile-grid-redesign__size")
        size = size_el.get_text(strip=True) if size_el else None

        covershot = wrapper.select_one("a.tile__covershot")
        img_el = covershot.find("img") if covershot else None
        # Cards are lazy-loaded (IntersectionObserver swaps data-src -> src as
        # they scroll into view); main.py's js_code scrolls the page first,
        # but data-src is a fallback in case a card's swap hadn't landed yet.
        image = img_el.get("src") or img_el.get("data-src") if img_el else None

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

    log.info("[poshmark-grid] extracted %d listings (out of %d wrappers)", len(results), len(wrappers))
    return results


# ── StockX ───────────────────────────────────────────────────────────────────

STOCKX_BASE = "https://stockx.com"
_STOCKX_PRICE_RE = re.compile(r"\$([\d,]+(?:\.\d+)?)")
# Lazy-loaded tiles ship this generic gray-X graphic as `src` until the real
# image swaps in on scroll; main.py's js_code scrolls the page first, but if
# a tile's swap hasn't landed (slow CDN, scroll cap hit) this is a dead give-
# away the "image" is StockX's own placeholder, not the product photo.
_STOCKX_PLACEHOLDER_IMAGE = "Product-Placeholder-Default"


def stockx_search_url(query: str) -> str:
    """Build the StockX search URL.

    Verified 2026-06-29: /search?s=<urlencoded> returns the product grid.
    The page is CSR, tiles hydrate after JS. 40 tiles on a typical query.
    wait_for: css:[data-testid="ProductTile"]
    """
    return f"{STOCKX_BASE}/search?s={quote(query.strip())}"


def extract_stockx_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from a StockX /search?s= page.

    Source: CSR-rendered tiles under [data-testid="ProductTile"]. Each tile's
    price is the Lowest Ask (not a completed sale), so isSold=False for all.
    Size is not exposed on the search grid (variant-level detail only).

    Card anatomy (verified 2026-06-29, 40 tiles on typical query):
        [data-testid="ProductTile"]
          a[data-testid="productTile-ProductSwitcherLink"][href="/<slug>"]
            img                                          → imageUrl
            [data-testid="product-tile-title"]           → title
            [data-testid="product-tile-lowest-ask-amount"] → "$319"
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    tiles = soup.select('[data-testid="ProductTile"]')
    if not tiles:
        log.warning("[stockx-grid] no ProductTile elements found, page may not have rendered")
        return []

    results: list[dict] = []
    for tile in tiles:
        link = tile.select_one('a[data-testid="productTile-ProductSwitcherLink"]')
        if not link:
            continue
        href = link.get("href", "")
        if not href:
            continue
        url = urljoin(STOCKX_BASE, href)

        title_el = tile.select_one('[data-testid="product-tile-title"]')
        title = title_el.get_text(strip=True) if title_el else None
        if isinstance(title, str):
            title = html_module.unescape(title)

        price_el = tile.select_one('[data-testid="product-tile-lowest-ask-amount"]')
        price: Optional[float] = None
        if price_el:
            m = _STOCKX_PRICE_RE.search(price_el.get_text(strip=True))
            if m:
                try:
                    price = float(m.group(1).replace(",", ""))
                except ValueError:
                    pass

        img_el = link.find("img")
        image = img_el.get("src") if img_el else None
        if image and _STOCKX_PLACEHOLDER_IMAGE in image:
            image = None

        results.append({
            "url": url,
            "title": title,
            "price": price,
            "currency": "USD",
            "isSold": False,
            "condition": None,
            "imageUrl": image,
            "size": None,
        })

        if len(results) >= limit:
            break

    log.info("[stockx-grid] extracted %d listings (out of %d tiles)", len(results), len(tiles))
    return results


# ── eBay ─────────────────────────────────────────────────────────────────────

EBAY_BASE = "https://www.ebay.com"

# eBay seeds every SRP with one or two "Shop on eBay" promo tiles that look
# exactly like a real card, same `.su-card-container`, same `.s-card__price`,
# but point at the placeholder item id 123456 and carry an ebaystatic house
# image. Verified 2026-08-25: exactly 2 of them on every query sampled. They
# are not listings; letting them through puts a fake $20.00 "Shop on eBay"
# row in the results and drags the price average down.
_EBAY_DECOY_ITEM_IDS = {"123456"}
_EBAY_DECOY_TITLES = {"shop on ebay"}
_EBAY_HOUSE_IMAGE_HOST = "ir.ebaystatic.com"

_EBAY_ITEM_ID_RE = re.compile(r"/itm/(\d+)")
# Leading symbol + amount. eBay writes ranges as "$20.00 to $40.00" (multi-
# variant listings); we take the low end, which is what the card leads with
# and what a sourcing user is comparing on.
_EBAY_PRICE_RE = re.compile(r"([$£€¥]|C\s*\$|AU\s*\$|US\s*\$)\s*([\d,]+(?:\.\d{1,2})?)")
_EBAY_CURRENCY_BY_SYMBOL = {"$": "USD", "US$": "USD", "C$": "CAD", "AU$": "AUD", "£": "GBP", "€": "EUR", "¥": "JPY"}


def ebay_search_url(query: str) -> str:
    """Build the eBay onsite search URL.

    Verified 2026-08-25: /sch/i.html?_nkw=<urlencoded> returns the full SRP
    grid server-side, ~81 cards, complete with title, price, image, size and
    condition. No JS hydration wait is needed for the cards themselves.

    Why this exists: eBay used to be the one platform on the Firecrawl
    "discover URLs then scrape each listing" path, which cost 10 Chromium
    renders and ~60s per search against ~6 usable results. One SRP render is
    ~5s for 40+ results. See PLATFORM_STATUS.md.
    """
    return f"{EBAY_BASE}/sch/i.html?_nkw={quote(query.strip())}"


def _ebay_parse_price(text) -> tuple[Optional[float], str]:
    """Parse an eBay price cell into (amount, ISO currency).

    Falls back to USD for an unrecognised symbol rather than dropping the
    price, the .com SRP is USD in the overwhelming majority of cases and a
    priced listing is more useful than a null.
    """
    if not isinstance(text, str):
        return None, "USD"
    m = _EBAY_PRICE_RE.search(text)
    if not m:
        return None, "USD"
    symbol = re.sub(r"\s+", "", m.group(1))
    try:
        amount = float(m.group(2).replace(",", ""))
    except ValueError:
        return None, "USD"
    return amount, _EBAY_CURRENCY_BY_SYMBOL.get(symbol, "USD")


def _ebay_subtitle_parts(card) -> tuple[Optional[str], Optional[str]]:
    """Pull (condition, size) out of an eBay card subtitle.

    The subtitle is a middot-joined attribute strip written by eBay in a
    stable order but with optional members:
        "Pre-Owned ·Size XL ·Carhartt"   → condition + size + brand
        "Brand New"                       → condition only
    Roughly 3 in 4 cards carry one at all, so both fields stay Optional.
    """
    el = card.select_one(".s-card__subtitle")
    if el is None:
        return None, None
    raw = html_module.unescape(el.get_text(" ", strip=True))
    condition: Optional[str] = None
    size: Optional[str] = None
    for part in (p.strip() for p in raw.split("·")):
        if not part:
            continue
        low = part.lower()
        if low.startswith("size"):
            candidate = part[4:].strip(": ").strip()
            size = candidate or None
        elif condition is None and ("new" in low or "owned" in low or "used" in low or "refurb" in low or "parts" in low):
            condition = part
    return condition, size


def extract_ebay_grid(html: str, *, limit: int = 24) -> list[dict]:
    """Extract listings from an eBay /sch/i.html?_nkw= search page.

    Card anatomy (verified 2026-08-25 across 3 queries, ~81 cards each):
        .su-card-container
          a.s-card__link[href*="/itm/<id>"]        → url (id in path)
            img.s-card__image                      → imageUrl
          .s-card__title > .su-styled-text         → title
          .s-card__title > .clipped                → "Opens in a new window
                                                      or tab" a11y text, MUST
                                                      be excluded from title
          .s-card__subtitle                        → "Pre-Owned ·Size XL ·Brand"
          .s-card__price                           → "$80.00"

    Two things about this markup that will bite a future editor:

    1. eBay migrated off the old `s-item__*` class family. Any selector you
       remember from a `s-item__title` era scraper matches zero nodes now;
       `su-card-container` + `s-card__*` is the current pair.
    2. `.s-card__title` contains a visually-hidden `.clipped` span. Calling
       get_text() on the title node yields "…JacketOpens in a new window or
       tab", which then fails relevance anchoring downstream. Select the
       inner `.su-styled-text` instead.

    All SRP results are active listings (sold items live behind
    `LH_Complete=1`, which this URL does not set), so isSold is always False.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select(".su-card-container")
    if not cards:
        log.warning("[ebay-grid] no su-card-container elements found, page may not have rendered")
        return []

    results: list[dict] = []
    seen_ids: set[str] = set()
    skipped_decoys = 0

    for card in cards:
        link = card.select_one('a[href*="/itm/"]')
        if not link:
            continue
        href = link.get("href", "")
        m = _EBAY_ITEM_ID_RE.search(href)
        if not m:
            continue
        item_id = m.group(1)

        title_el = card.select_one(".s-card__title .su-styled-text")
        title = html_module.unescape(title_el.get_text(strip=True)) if title_el else None

        img_el = card.select_one("img.s-card__image") or card.find("img")
        image = img_el.get("src") if img_el else None

        # Promo tile, not a listing, see _EBAY_DECOY_ITEM_IDS above.
        if (
            item_id in _EBAY_DECOY_ITEM_IDS
            or (title or "").strip().lower() in _EBAY_DECOY_TITLES
            or (image and _EBAY_HOUSE_IMAGE_HOST in image)
        ):
            skipped_decoys += 1
            continue

        # The href carries a multi-hundred-character `itmmeta`/`itmprp`
        # tracking payload that differs per impression, so the same listing
        # would dedupe as two different URLs across searches (and churn
        # `last_seen_urls` on every alert run). The item id is the identity.
        if item_id in seen_ids:
            continue
        seen_ids.add(item_id)
        url = f"{EBAY_BASE}/itm/{item_id}"

        price_el = card.select_one(".s-card__price")
        price, currency = _ebay_parse_price(price_el.get_text(strip=True) if price_el else None)

        condition, size = _ebay_subtitle_parts(card)

        results.append({
            "url": url,
            "title": title,
            "price": price,
            "currency": currency,
            "isSold": False,
            "condition": condition,
            "imageUrl": image,
            "size": size,
        })

        if len(results) >= limit:
            break

    log.info(
        "[ebay-grid] extracted %d listings (out of %d cards, %d promo tiles skipped)",
        len(results), len(cards), skipped_decoys,
    )
    return results


# ── Dispatch ────────────────────────────────────────────────────────────────

SEARCH_PAGE_PLATFORMS = {
    "thredup", "realreal", "grailed", "mercari", "depop",
    "vestiaire", "vinted", "poshmark", "stockx", "ebay",
}


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
    if platform == "vestiaire":
        return vestiaire_search_url(query)
    if platform == "vinted":
        return vinted_search_url(query)
    if platform == "poshmark":
        return poshmark_search_url(query)
    if platform == "stockx":
        return stockx_search_url(query)
    if platform == "ebay":
        return ebay_search_url(query)
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
    if platform == "vestiaire":
        return extract_vestiaire_grid(html, limit=limit)
    if platform == "vinted":
        return extract_vinted_grid(html, limit=limit)
    if platform == "poshmark":
        return extract_poshmark_grid(html, limit=limit)
    if platform == "stockx":
        return extract_stockx_grid(html, limit=limit)
    if platform == "ebay":
        return extract_ebay_grid(html, limit=limit)
    return []
