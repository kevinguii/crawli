"""Platform-specific extraction config — ported from lib/firecrawl.ts."""

LISTING_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Product/listing title"},
        "price": {"type": "number", "description": "Price as a plain number with no currency symbol"},
        "currency": {"type": "string", "description": "Currency code of the price, e.g. USD, GBP, EUR"},
        "isSold": {"type": "boolean", "description": "True if the item is sold or no longer available"},
        "condition": {"type": "string", "description": "Item condition, e.g. New, Used, Like New, Deadstock"},
        "imageUrl": {"type": "string", "description": "Full URL of the main product image"},
    },
}

PLATFORM_PROMPTS = {
    "stockx": (
        "Extract the Lowest Ask price (also labeled 'Buy Now') as the price field. "
        "Ignore the Last Sale price, the Highest Bid price, and any prices in "
        "'Related Products', 'More from this Brand', or 'Recently Viewed' sections. "
        "If no Lowest Ask / Buy Now price is shown, set price to null."
    ),
    "grailed": (
        "Extract the current listing price as the price field. "
        'If the page shows a Sold badge or the text "Sorry, this listing is no longer available", '
        "set isSold to true. Ignore prices from suggested/related listings."
    ),
    "depop": (
        "Extract the CURRENT sale price as the price field — this is the live price the "
        "buyer would pay right now. If both an original price and a discounted price are shown, "
        "use the discounted price (NOT the strikethrough/original). "
        "Ignore prices from 'More from this seller', 'Similar items', or 'Recently viewed' sections. "
        "Include the currency code (USD, GBP, EUR, etc). "
        "If the item is sold or unavailable, set isSold to true."
    ),
    "poshmark": (
        "Extract the current listing price (not the original retail price) as the price field. "
        "Ignore prices from related/similar listings shown lower on the page. "
        "Set isSold=true if ANY of the following are visible: a 'SOLD' badge or banner on the "
        "main listing, the text 'This listing has been sold', or the listing being marked "
        "out of stock / no longer available. Look near the top of the page for sold status."
    ),
    "default": (
        "Extract the listing price and currency. "
        "If the item is sold or unavailable, set isSold to true."
    ),
}

# Scope the markdown/HTML that the LLM (or extractor) sees to the main product
# container, dropping headers, footers, sidebars, related items, and ad rails.
# Reduces token count + dramatically improves accuracy.
#
# word_count_threshold: 0 keeps short blocks (price chips) that the default
# filter strips.
PLATFORM_CRAWLER_OPTIONS = {
    "depop": {
        "word_count_threshold": 0,
        "target_elements": ["main", "[data-testid='product__container']", "article"],
    },
    "ebay": {"word_count_threshold": 0},
    "stockx": {
        "target_elements": [
            "[data-component='MainContent']",
            "[data-component='ProductDetailsHeader']",
            "main",
        ],
    },
    "grailed": {
        "target_elements": ["#listing-page", "main", "article"],
    },
    "poshmark": {
        "target_elements": [".listing-page", "main", "[data-test='listing-details']"],
    },
}


def get_prompt(platform: str) -> str:
    return PLATFORM_PROMPTS.get(platform, PLATFORM_PROMPTS["default"])


def get_crawler_options(platform: str) -> dict:
    return PLATFORM_CRAWLER_OPTIONS.get(platform, {})


# Per-platform overrides for LLMExtractionStrategy kwargs.
# eBay listing pages render to ~50K chars of markdown; without chunking,
# gpt-4o-mini struggles to produce schema-valid JSON in one shot and the
# strategy returns empty extracted_content.
PLATFORM_EXTRACTION_OPTIONS = {
    "ebay": {"apply_chunking": True},
}


def get_extraction_options(platform: str) -> dict:
    return PLATFORM_EXTRACTION_OPTIONS.get(platform, {})


# Structured-data extraction (JSON-LD for Depop/Grailed/Poshmark, testid CSS
# for StockX) lives in structured_extractors.py — that module is the primary
# extraction tier. LLM extraction below remains as a last resort.
