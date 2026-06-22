"""Per-platform structured-data extractors.

These read deterministic signals (Schema.org JSON-LD, specific data-testid
attributes) directly from the rendered HTML — no LLM, no token cost, no
guessing between strikethrough/related-item/listing prices.

Returns a dict with the canonical ScrapedListing shape (title, price, currency,
isSold, condition, imageUrl) or None if the signal isn't present (caller
should fall back to LLM extraction).
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

log = logging.getLogger("crawl4ai-sidecar")


# ── Schema.org availability → isSold ─────────────────────────────────────────

_SOLD_AVAILABILITY_TOKENS = (
    "outofstock",
    "soldout",
    "discontinued",
    "out of stock",
    "sold out",
)


def _availability_is_sold(value) -> bool:
    if not isinstance(value, str):
        return False
    v = value.lower().replace("https://", "").replace("http://", "").replace("schema.org/", "")
    return any(t in v.replace(" ", "").replace("_", "") for t in [
        "outofstock", "soldout", "discontinued"
    ])


def _condition_label(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    v = value.lower()
    # Schema.org OfferItemCondition vocabulary
    if "new" in v:
        return "New"
    if "used" in v:
        return "Used"
    if "refurbished" in v:
        return "Refurbished"
    if "damaged" in v:
        return "Damaged"
    return None


# ── JSON-LD helpers ──────────────────────────────────────────────────────────

def _iter_jsonld(soup: BeautifulSoup):
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        body = tag.string or tag.text
        if not body:
            continue
        try:
            data = json.loads(body)
        except Exception:  # noqa: BLE001 — sites sometimes embed broken JSON-LD
            continue
        if isinstance(data, list):
            yield from data
        else:
            yield data


def _find_product_jsonld(soup: BeautifulSoup) -> Optional[dict]:
    """Find the first JSON-LD node whose @type is Product (or contains a Product offer)."""
    for node in _iter_jsonld(soup):
        if not isinstance(node, dict):
            continue
        t = node.get("@type")
        types = t if isinstance(t, list) else [t]
        if any(isinstance(x, str) and x.lower() == "product" for x in types):
            return node
        # Some sites nest under @graph
        graph = node.get("@graph")
        if isinstance(graph, list):
            for g in graph:
                if isinstance(g, dict):
                    gt = g.get("@type")
                    gtypes = gt if isinstance(gt, list) else [gt]
                    if any(isinstance(x, str) and x.lower() == "product" for x in gtypes):
                        return g
    return None


def _first_offer(product: dict) -> Optional[dict]:
    offers = product.get("offers")
    if isinstance(offers, dict):
        return offers
    if isinstance(offers, list) and offers:
        return offers[0] if isinstance(offers[0], dict) else None
    return None


def _first_image(product: dict) -> Optional[str]:
    img = product.get("image")
    if isinstance(img, str):
        return img
    if isinstance(img, list) and img:
        first = img[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            # contentUrl: Schema.org ImageObject (Vestiaire). url/@id: simpler shapes (Depop/Grailed).
            return first.get("contentUrl") or first.get("url") or first.get("@id")
    if isinstance(img, dict):
        return img.get("contentUrl") or img.get("url") or img.get("@id")
    return None


def _extract_size_from_product(product: dict) -> Optional[str]:
    """Extract size from a Schema.org Product node.

    Grailed and similar platforms may store size as a top-level "size" string or
    inside "additionalProperty" (a list of PropertyValue objects).
    """
    # Direct string field
    raw = product.get("size")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()

    # additionalProperty list: [{@type: PropertyValue, name: "size", value: "L"}, ...]
    additional = product.get("additionalProperty")
    if isinstance(additional, list):
        for prop in additional:
            if not isinstance(prop, dict):
                continue
            name = prop.get("name", "")
            if isinstance(name, str) and name.lower() == "size":
                val = prop.get("value")
                if isinstance(val, str) and val.strip():
                    return val.strip()

    return None


def _extract_color_from_product(product: dict) -> Optional[str]:
    """Extract color from a Schema.org Product node.

    Verified live 2026-06-21: Poshmark emits a top-level "color" string
    (normalized, e.g. listing titled "...Coral..." had color="Orange") and
    ThredUp's search-grid JSON-LD also carries a direct "color" field
    ("Black", etc). Same dual-shape pattern as size — check the direct field,
    then additionalProperty.
    """
    raw = product.get("color")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()

    additional = product.get("additionalProperty")
    if isinstance(additional, list):
        for prop in additional:
            if not isinstance(prop, dict):
                continue
            name = prop.get("name", "")
            if isinstance(name, str) and name.lower() == "color":
                val = prop.get("value")
                if isinstance(val, str) and val.strip():
                    return val.strip()

    return None


def _extract_from_jsonld(soup: BeautifulSoup) -> Optional[dict]:
    """Generic JSON-LD Product extractor (Depop, Grailed, Poshmark).

    Returns a dict matching the ScrapedListing shape, or None.
    """
    product = _find_product_jsonld(soup)
    if not product:
        return None

    offer = _first_offer(product) or {}

    # price can live on offer or on product directly
    price = offer.get("price")
    if price is None:
        price = product.get("price")

    # currency
    currency = offer.get("priceCurrency") or product.get("priceCurrency")

    availability = offer.get("availability") or product.get("availability")
    is_sold = _availability_is_sold(availability)

    condition = offer.get("itemCondition") or product.get("itemCondition")
    condition_label = _condition_label(condition)

    name = product.get("name") if isinstance(product.get("name"), str) else None
    image = _first_image(product)
    size = _extract_size_from_product(product)
    color = _extract_color_from_product(product)

    # Reject the node if it has NO price — caller should fall back to LLM.
    #
    # EXCEPTION: a confirmed-sold listing (availability=OutOfStock/SoldOut/
    # Discontinued) is a VALID result even without a price. Some marketplaces
    # drop offers.price once an item sells; without this carve-out the price-gate
    # would discard the whole node → None → LLM, silently losing the sold signal
    # that the watchlist relies on to flip an item to "Sold" (and that search
    # uses to filter sold items out). The LLM can't recover a price that isn't on
    # the page anyway, and might hallucinate one. price=None + isSold=True is the
    # honest answer. Mirrors the StockX "price=None is a valid no-Ask result"
    # precedent. is_sold is only True when availability explicitly says sold, so
    # a partially-rendered page (no availability) still correctly falls through.
    if price is None and not is_sold:
        return None

    return {
        "title": name,
        "price": price,
        "currency": currency,
        "isSold": is_sold,
        "condition": condition_label,
        "imageUrl": image,
        "size": size,
        "color": color,
    }


def _jsonld_product_color(soup: BeautifulSoup) -> Optional[str]:
    """Best-effort color lookup from a page's JSON-LD Product node, for
    platforms whose primary extractor doesn't go through `_extract_from_jsonld`
    (e.g. StockX/Vinted, where price lives elsewhere and the JSON-LD path was
    never used). Purely additive — callers should not let a parse failure here
    affect price/title/image extraction.

    Verified live 2026-06-21: both StockX and Vinted emit a direct top-level
    `color` string on their Product JSON-LD (StockX: official colorway names
    like "Diffused Blue"; Vinted: plain color words like "Blue") even though
    neither platform's price lives there.
    """
    try:
        product = _find_product_jsonld(soup)
        if not product:
            return None
        return _extract_color_from_product(product)
    except Exception:  # noqa: BLE001 — never let this break price/title extraction
        return None


# ── Platform-specific extractors ─────────────────────────────────────────────

def extract_depop(html: str) -> Optional[dict]:
    """Depop emits <script type='application/ld+json'> with @type=Product
    and offers.price = listing price (verified against jeff250-* on 2026-05-15).
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    return _extract_from_jsonld(soup)


def extract_grailed(html: str) -> Optional[dict]:
    """Grailed emits JSON-LD Product for listings (when the page is fully rendered)."""
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    return _extract_from_jsonld(soup)


def extract_stockx(html: str) -> Optional[dict]:
    """StockX does NOT emit listing-level JSON-LD with the Lowest Ask.
    Instead, the main listing's Lowest Ask / Buy Now price is rendered into
    <h2 data-testid='trade-box-buy-amount'>$74</h2>.

    Critically, the page also contains:
      - <p data-testid='product-tile-lowest-ask-amount'>…</p> for RELATED products
        (carousel) — these MUST be ignored.
      - The literal string "There are no Asks at this time" in the i18n bundle,
        ALWAYS present whether or not the listing has an ask — don't rely on it.

    If 'trade-box-buy-amount' is absent → the listing has no Ask → return
    price=None (NOT a fallback to LLM; the LLM would just guess a number).
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")

    ask_el = soup.select_one("[data-testid='trade-box-buy-amount']")
    ask_text = ask_el.get_text(strip=True) if ask_el else None

    # Conservative price gate: when a StockX listing has no live Ask for the
    # default variant, the trade box shows the Last Sale number in the same
    # amount element. The sibling label switches from "Buy Now" to "Last Sale".
    # We look at a tight ancestor (parent + grandparent only) so we don't pick
    # up "Last Sale" mentions from the sales-history chart further down the page.
    # If the label says "Last Sale" without "Buy Now", treat as no Ask.
    if ask_el is not None and ask_text:
        local_text = ""
        node = ask_el.parent
        for _ in range(2):
            if node is None:
                break
            local_text = node.get_text(" ", strip=True).lower()
            node = node.parent
        has_buy_now = "buy now" in local_text or "place bid" in local_text
        has_last_sale = "last sale" in local_text or "no asks" in local_text
        if has_last_sale and not has_buy_now:
            ask_text = None

    title_el = (
        soup.select_one("[data-testid='product-detail-product-title']")
        or soup.select_one("h1")
    )
    title = title_el.get_text(" ", strip=True) if title_el else None

    og_image = soup.find("meta", property="og:image")
    image = og_image.get("content") if og_image else None

    # Distinguish "page didn't render" from "listing has no Ask".
    # If neither title nor price is present, the SPA likely hadn't painted —
    # return None so the caller falls back to LLM.
    # If title IS present but the trade-box is empty, that's a valid "no Ask"
    # outcome and price=None is the correct answer.
    if not title and not ask_text:
        return None

    return {
        "title": title,
        "price": ask_text,  # e.g. "$74" — coerce_listing strips $ via _parse_price
        "currency": "USD",
        "isSold": False,
        "condition": None,
        "imageUrl": image,
        "color": _jsonld_product_color(soup),
    }


def extract_poshmark(html: str) -> Optional[dict]:
    """Poshmark listing extractor — hybrid, JSON-LD primary.

    As of 2026-05-31 Poshmark DOES emit Schema.org Product JSON-LD on every
    listing page (this was NOT true on 2026-05-15, when the original og:meta +
    <p class="h1"> parser below was written). Surveyed 12/12 listings
    (6 available + 6 sold) via scripts/poshmark_jsonld_probe.py:
      - offers.price = listing price (not the strikethrough MSRP)
      - offers.availability = InStock | OutOfStock  -> isSold (12/12 correct)
      - offers.itemCondition = New/Used  (the legacy parser left condition=None)
      - sold listings KEEP their price, so the JSON-LD price-gate doesn't drop
        the sold signal.

    Strategy (each tier only runs if the previous misses):
      1. JSON-LD Product node  -> deterministic + condition (the common path)
      2. Legacy og:meta + <p class="h1"> parser  -> safety net for a real
         product page that somehow shipped without JSON-LD (partial render,
         A/B variant, older listing) so we don't punt straight to the LLM
      3. (caller) None -> LLM fallback  (block walls / login redirects land here)
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")

    jsonld = _extract_from_jsonld(soup)
    if jsonld is not None:
        return jsonld

    return _extract_poshmark_legacy(soup, html)


def _extract_poshmark_legacy(soup: BeautifulSoup, html: str) -> Optional[dict]:
    """Pre-JSON-LD Poshmark parser (verified 2026-05-15). Kept as a fallback:
      - <meta property="og:title"> / <meta property="og:image"> give us title + image
      - The main listing's price is in <p class="h1"><span>$68</span><span>$180</span></p>
        where $68 is the listing price and $180 is the original/MSRP.
      - data-et-prop-listing_price="68" is also present (clean number) but appears
        only on tracking-tile elements — using the h1 is safer.
      - data-et-prop-inventory_status="available"|"sold" gates isSold.
    """
    og_title = soup.find("meta", property="og:title")
    og_image = soup.find("meta", property="og:image")
    og_type = soup.find("meta", property="og:type")
    # Bail if this isn't a product page (e.g. anti-bot wall or login redirect)
    if not og_title or (og_type and og_type.get("content") != "product"):
        return None

    title = og_title.get("content")
    image = og_image.get("content") if og_image else None

    price = None
    h1 = soup.find("p", class_="h1")
    if h1:
        # First <span> is the listing price, e.g. "$68". Take its text and parse a number.
        spans = h1.find_all("span")
        for s in spans:
            txt = s.get_text(strip=True)
            m = re.search(r"[\d]+(?:\.\d+)?", txt)
            if m:
                price = m.group(0)
                break

    # Sold detection — multiple defense-in-depth signals on Poshmark:
    #   - data-et-prop-inventory_status="sold_out" (tracking attribute on usage element)
    #   - schema.org/OutOfStock as an availability value (embedded microdata/JSON-LD)
    #   - An ELEMENT with class containing "listing__status-banner__title--sold" — note:
    #     the CSS RULE for this class is in every page's <style> block, so a plain
    #     substring search false-fires. Use BeautifulSoup to query the DOM.
    sold_banner = soup.find(class_="listing__status-banner__title--sold") is not None
    is_sold = bool(
        re.search(r'data-et-prop-inventory_status="sold(?:_out|out)?"', html, re.IGNORECASE)
        or re.search(r'"availability":"[^"]*schema\.org/OutOfStock"', html)
        or sold_banner
    )

    if price is None and not is_sold:
        # Page rendered but we couldn't find a price — let LLM try.
        return None

    return {
        "title": title,
        "price": price,
        "currency": "USD",  # Poshmark .com listings are USD
        "isSold": is_sold,
        "condition": None,
        "imageUrl": image,
    }


def extract_mercari(html: str) -> Optional[dict]:
    """Mercari is Next.js. The real listing data lives in __NEXT_DATA__ at:
        props.pageProps.serverState['ItemDetail:<itemId>']
    with fields { name, price (in CENTS), originalPrice (cents), photos[].imageUrl, status }.

    The page's <meta property="og:image"> is a generic Mercari placeholder
    (ogp_image_1.png) — DO NOT use it. Use photos[0].imageUrl.

    Status enum observed: "on_sale" (available), "trading" / "sold_out" (sold).

    Verified against m21075527136 (price=11000 cents = $110.00) on 2026-05-15.
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    nd = soup.find("script", id="__NEXT_DATA__")
    if not nd or not nd.string:
        return None
    try:
        data = json.loads(nd.string)
    except Exception:  # noqa: BLE001
        return None

    server_state = (
        data.get("props", {})
        .get("pageProps", {})
        .get("serverState", {})
    )
    item = None
    for key, value in server_state.items():
        if isinstance(key, str) and key.startswith("ItemDetail:") and isinstance(value, dict):
            item = value
            break
    if not item:
        return None

    price_cents = item.get("price")
    price = None
    if isinstance(price_cents, (int, float)):
        price = price_cents / 100.0

    name = item.get("name") if isinstance(item.get("name"), str) else None

    photos = item.get("photos") or []
    image = None
    if isinstance(photos, list) and photos:
        first = photos[0]
        if isinstance(first, dict):
            image = first.get("imageUrl") or first.get("thumbnail")

    status = item.get("status")
    is_sold = isinstance(status, str) and status.lower() in (
        "sold_out", "trading", "sold", "completed",
    )

    if price is None and name is None:
        return None

    return {
        "title": name,
        "price": price,
        "currency": "USD",  # mercari.com/us is USD-only
        "isSold": is_sold,
        "condition": None,
        "imageUrl": image,
    }


# Vinted uses Next.js RSC streaming. The item's price is serialized into one of
# the inline <script> chunks as escaped JSON like:
#   \"price\":{\"amount\":\"75.0\",\"currency_code\":\"USD\"}    ← listing price (USE THIS)
#   \"price\":{\"amount\":\"40\",\"currencyCode\":\"CZK\"}       ← shipping option in Czech market (IGNORE)
# Note the underscore in currency_code — that's the listing-pricing block.
# camelCase currencyCode is the shipping-options block.
#
# Multiple matches with currency_code exist (item price, service fee, total);
# the FIRST one is the item's list price.
_VINTED_PRICE_RE = re.compile(
    r'\\"price\\":\{\\"amount\\":\\"([0-9.]+)\\",\\"currency_code\\":\\"([A-Z]{3})\\"'
)


def extract_vinted(html: str) -> Optional[dict]:
    """Verified against items 8139626124 ($75 USD) and 7287762265 ($32.25 USD)
    on 2026-05-15.

    og:image IS the listing photo on Vinted (not a placeholder).
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")

    og_title = soup.find("meta", property="og:title")
    og_image = soup.find("meta", property="og:image")
    title = og_title.get("content") if og_title else None
    # Strip the trailing " | Vinted" branding suffix
    if isinstance(title, str):
        title = re.sub(r"\s*\|\s*Vinted\s*$", "", title)
    image = og_image.get("content") if og_image else None

    m = _VINTED_PRICE_RE.search(html)
    price = m.group(1) if m else None
    currency = m.group(2) if m else "USD"

    if price is None and title is None:
        return None

    return {
        "title": title,
        "price": price,
        "currency": currency,
        "isSold": False,
        "condition": None,
        "imageUrl": image,
        "color": _jsonld_product_color(soup),
    }


def extract_thredup(html: str) -> Optional[dict]:
    """ThredUp product pages emit Schema.org Product JSON-LD with offers.price
    and offers.availability. Same shape as Depop/Grailed — the generic
    JSON-LD helper handles it. Verified against product/.../220045833.
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    return _extract_from_jsonld(soup)


def extract_ebay(html: str) -> Optional[dict]:
    """eBay /itm/ pages embed Schema.org Product JSON-LD with offers.price,
    priceCurrency, availability, and itemCondition. Same shape the generic
    helper handles. Surveyed 4/4 listings 2026-05-21 (gucci marmont bag).
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    return _extract_from_jsonld(soup)


def extract_vestiaire(html: str) -> Optional[dict]:
    """Vestiaire Collective product pages emit Schema.org Product JSON-LD with
    offers.price (USD when fetched from us.vestiairecollective.com), itemCondition,
    and availability. Generic helper handles it. Surveyed 5/5 listings 2026-05-21.
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    return _extract_from_jsonld(soup)


PLATFORM_EXTRACTORS = {
    "depop": extract_depop,
    "grailed": extract_grailed,
    "poshmark": extract_poshmark,
    "stockx": extract_stockx,
    "mercari": extract_mercari,
    "vinted": extract_vinted,
    "thredup": extract_thredup,
    "ebay": extract_ebay,
    "vestiaire": extract_vestiaire,
}


def extract_structured(platform: str, html: str) -> Optional[dict]:
    """Dispatch to the platform's structured extractor.

    Returns dict on success, None to fall through to LLM.
    For StockX specifically, returns a dict with price=None (NOT None) when the
    listing has no Ask — that's a successful "no price available" outcome and
    should NOT trigger LLM fallback.
    """
    fn = PLATFORM_EXTRACTORS.get(platform)
    if not fn:
        return None
    return fn(html)
