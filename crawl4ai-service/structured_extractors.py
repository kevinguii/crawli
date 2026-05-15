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
            return first.get("url") or first.get("@id")
    if isinstance(img, dict):
        return img.get("url") or img.get("@id")
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

    # Reject the node if it has NO price — caller should fall back.
    if price is None:
        return None

    return {
        "title": name,
        "price": price,
        "currency": currency,
        "isSold": is_sold,
        "condition": condition_label,
        "imageUrl": image,
    }


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


def extract_poshmark(html: str) -> Optional[dict]:
    """Poshmark emits JSON-LD Product for listings."""
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
    }


PLATFORM_EXTRACTORS = {
    "depop": extract_depop,
    "grailed": extract_grailed,
    "poshmark": extract_poshmark,
    "stockx": extract_stockx,
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
