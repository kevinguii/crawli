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
        "Extract the Buy Now (Lowest Ask) price as the price field. "
        "Do NOT use the Last Sale price. "
        "Do NOT include prices from related products at the bottom of the page. "
        "If no Buy Now price exists, set price to null."
    ),
    "grailed": (
        "Extract the listing price. "
        'If the item shows a Sold badge or the text says "Sorry, this listing is no longer available", '
        "set isSold to true."
    ),
    "depop": (
        "Extract the current price after any discounts or sales. "
        "Include the currency field (USD, GBP, EUR, etc). "
        "If the item is sold or unavailable, set isSold to true."
    ),
    "default": (
        "Extract the listing price and currency. "
        "If the item is sold or unavailable, set isSold to true."
    ),
}

# Depop requires full-page content — main-content extraction picks up the
# "Similar Items" sidebar instead of the listing details.
# In crawl4ai, lowering word_count_threshold keeps short blocks (price chips).
PLATFORM_CRAWLER_OPTIONS = {
    "depop": {"word_count_threshold": 0},
    # eBay: listing pages have short structured blocks (price, condition, shipping
    # rows) that the default word-count filter strips, leaving the LLM with no
    # content to extract from.
    "ebay": {"word_count_threshold": 0},
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
