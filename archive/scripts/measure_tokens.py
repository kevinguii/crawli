#!/usr/bin/env python3
"""Measure token usage and costs for searches across all 10 platforms.

Usage:
    python scripts/measure_tokens.py --query "gucci bag" --platforms all
    python scripts/measure_tokens.py --query "nike shoes" --platforms grailed depop
"""

import asyncio
import json
import os
import sys
from typing import Optional
import httpx
import tiktoken

# Configuration
SIDECAR_URL = os.getenv("CRAWL4AI_URL", "http://localhost:8000")
ALL_PLATFORMS = [
    "grailed", "depop", "poshmark", "mercari", "vinted",
    "thredup", "ebay", "vestiaire", "stockx", "realreal"
]

# Pricing (as of May 2026)
GPT_4O_MINI_INPUT_PRICE = 0.15 / 1_000_000  # $0.15 per 1M tokens
GPT_4O_MINI_OUTPUT_PRICE = 0.60 / 1_000_000  # $0.60 per 1M tokens
FIRECRAWL_PRICE_PER_CREDIT = 20 / 5000  # $20 per 5000 credits

# Token estimator using tiktoken
def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    """Count tokens using tiktoken."""
    try:
        enc = tiktoken.encoding_for_model(model)
        return len(enc.encode(text))
    except Exception:
        # Fallback: rough estimate (1 token ≈ 4 chars)
        return len(text) // 4


def estimate_llm_tokens(html_content: str, platform: str, response_json: dict) -> tuple[int, int]:
    """Estimate input and output tokens for LLM extraction.

    Returns: (input_tokens, output_tokens)
    """
    # Platform-specific prompts (from extractors.py)
    prompts = {
        "stockx": "Extract the Lowest Ask price (also labeled 'Buy Now') as the price field. "
                  "Ignore the Last Sale price, the Highest Bid price, and any prices in "
                  "'Related Products', 'More from this Brand', or 'Recently Viewed' sections. "
                  "If no Lowest Ask / Buy Now price is shown, set price to null.",
        "grailed": "Extract the current listing price as the price field. "
                   'If the page shows a Sold badge or the text "Sorry, this listing is no longer available", '
                   "set isSold to true. Ignore prices from suggested/related listings.",
        "depop": "Extract the CURRENT sale price as the price field — this is the live price the "
                 "buyer would pay right now. If both an original price and a discounted price are shown, "
                 "use the discounted price (NOT the strikethrough/original). "
                 "Ignore prices from 'More from this seller', 'Similar items', or 'Recently viewed' sections. "
                 "Include the currency code (USD, GBP, EUR, etc). "
                 "If the item is sold or unavailable, set isSold to true.",
        "poshmark": "Extract the current listing price (not the original retail price) as the price field. "
                    "Ignore prices from related/similar listings shown lower on the page. "
                    "Set isSold=true if ANY of the following are visible: a 'SOLD' badge or banner on the "
                    "main listing, the text 'This listing has been sold', or the listing being marked "
                    "out of stock / no longer available. Look near the top of the page for sold status.",
        "vestiaire": "Extract the current asking price as the price field. "
                     "Use the currency shown (EUR, GBP, USD, etc). "
                     "Set isSold=true if the item is marked as sold or no longer available. "
                     "Ignore prices from 'Similar items', 'You may also like', or recommendation sections.",
        "default": "Extract the listing price and currency. "
                   "If the item is sold or unavailable, set isSold to true."
    }

    prompt = prompts.get(platform, prompts["default"])
    schema_desc = """
    Extract these fields into JSON:
    - title (string): Product/listing title
    - price (number): Price as a plain number with no currency symbol
    - currency (string): Currency code of the price (USD, GBP, EUR, etc)
    - isSold (boolean): True if the item is sold or no longer available
    - condition (string): Item condition (New, Used, Like New, Deadstock, etc)
    - imageUrl (string): Full URL of the main product image
    """

    # Estimate input tokens
    system_prompt = f"{prompt}\n\n{schema_desc}"
    html_tokens = count_tokens(html_content)
    system_tokens = count_tokens(system_prompt)
    total_input = html_tokens + system_tokens

    # Estimate output tokens (JSON response with 6 fields, avg 50 tokens per field)
    output_estimate = 100  # JSON structure + ~6 fields

    return total_input, output_estimate


class TokenMeasurer:
    def __init__(self):
        self.results = {}
        self.client = httpx.AsyncClient(timeout=120)

    async def measure_platform(self, platform: str, query: str) -> dict:
        """Measure token usage for a single platform search."""
        print(f"\n📊 Measuring {platform.upper()}...")

        try:
            # Search via Firecrawl (if applicable)
            if platform in ["thredup", "realreal"]:
                # These use /scrape-search endpoint
                resp = await self.client.post(
                    f"{SIDECAR_URL}/scrape-search",
                    json={"platform": platform, "query": query, "limit": 5},
                )
                data = resp.json()
                listings = data.get("results", [])
                firecrawl_credits = 0  # /scrape-search bypasses Firecrawl
            else:
                # These use Firecrawl's site: search + individual scraping
                # Firecrawl usage: ~1 credit per search, ~2-5 per scrape
                listings = []
                # We'll estimate 5 listings per platform
                firecrawl_credits = 1 + (5 * 3)  # 1 for search, ~3 per scrape

            # Estimate tokens from results
            total_input_tokens = 0
            total_output_tokens = 0
            html_size_estimate = 0

            for listing in listings:
                # Estimate HTML size based on platform characteristics
                platform_html_sizes = {
                    "grailed": 35000,      # Medium SPA
                    "depop": 40000,        # Heavy React
                    "poshmark": 32000,     # Medium
                    "mercari": 28000,      # Light-medium
                    "vinted": 25000,       # Light
                    "thredup": 0,          # Structured extract, no LLM
                    "ebay": 50000,         # Very heavy, chunked
                    "vestiaire": 30000,    # Medium
                    "stockx": 35000,       # Heavy React
                    "realreal": 0,         # Structured extract
                }

                html_est = platform_html_sizes.get(platform, 30000)

                # If structured extractor succeeded, skip LLM tokens
                if platform in ["thredup", "realreal"]:
                    # Search page extraction is JSON-LD based, negligible LLM cost
                    input_t, output_t = 0, 0
                else:
                    # Estimate LLM tokens
                    input_t, output_t = estimate_llm_tokens(
                        "X" * html_est,  # Simulated HTML
                        platform,
                        listing
                    )

                total_input_tokens += input_t
                total_output_tokens += output_t
                html_size_estimate += html_est

            # If no listings were returned, assume 5 attempts (max results)
            if not listings and platform not in ["thredup", "realreal", "realreal"]:
                listings_attempted = 5
                platform_html_sizes = {
                    "grailed": 35000, "depop": 40000, "poshmark": 32000,
                    "mercari": 28000, "vinted": 25000, "ebay": 50000,
                    "vestiaire": 30000, "stockx": 35000,
                }
                html_est = platform_html_sizes.get(platform, 30000)
                for _ in range(listings_attempted):
                    input_t, output_t = estimate_llm_tokens("X" * html_est, platform, {})
                    total_input_tokens += input_t
                    total_output_tokens += output_t

            # Calculate costs
            openai_cost = (
                (total_input_tokens * GPT_4O_MINI_INPUT_PRICE) +
                (total_output_tokens * GPT_4O_MINI_OUTPUT_PRICE)
            )
            firecrawl_cost = firecrawl_credits * FIRECRAWL_PRICE_PER_CREDIT
            total_cost = openai_cost + firecrawl_cost

            result = {
                "platform": platform,
                "query": query,
                "listings_found": len(listings),
                "firecrawl_credits": firecrawl_credits,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "total_tokens": total_input_tokens + total_output_tokens,
                "openai_cost": openai_cost,
                "firecrawl_cost": firecrawl_cost,
                "total_cost": total_cost,
                "html_size_estimate_kb": html_size_estimate / 1024,
            }

            # Print platform summary
            print(f"  ✓ {len(listings)} listings found")
            print(f"  • Input tokens: {total_input_tokens:,}")
            print(f"  • Output tokens: {total_output_tokens:,}")
            print(f"  • OpenAI cost: ${openai_cost:.4f}")
            print(f"  • Firecrawl cost: ${firecrawl_cost:.4f}")
            print(f"  • Total: ${total_cost:.4f}")

            return result

        except Exception as e:
            print(f"  ✗ Error: {e}")
            return {
                "platform": platform,
                "error": str(e),
                "total_cost": 0,
            }

    async def measure_all(self, query: str, platforms: list[str] = None):
        """Measure token usage across multiple platforms."""
        if platforms is None:
            platforms = ALL_PLATFORMS
        elif platforms == ["all"]:
            platforms = ALL_PLATFORMS

        print(f"\n🔍 Measuring token usage for query: \"{query}\"")
        print(f"   Platforms: {', '.join(platforms)}")
        print("=" * 70)

        results = []
        for platform in platforms:
            result = await self.measure_platform(platform, query)
            results.append(result)

        # Summary
        print("\n" + "=" * 70)
        print("📋 SUMMARY")
        print("=" * 70)

        total_tokens = sum(r.get("total_tokens", 0) for r in results)
        total_openai_cost = sum(r.get("openai_cost", 0) for r in results)
        total_firecrawl_cost = sum(r.get("firecrawl_cost", 0) for r in results)
        total_cost = total_openai_cost + total_firecrawl_cost
        total_listings = sum(r.get("listings_found", 0) for r in results)

        print(f"\n📊 Token Usage:")
        print(f"   Total tokens: {total_tokens:,}")
        print(f"   Avg tokens/platform: {total_tokens // len(results):,}")

        print(f"\n💰 Cost Breakdown:")
        print(f"   OpenAI (GPT-4o-mini): ${total_openai_cost:.4f}")
        print(f"   Firecrawl: ${total_firecrawl_cost:.4f}")
        print(f"   TOTAL: ${total_cost:.4f}")

        print(f"\n📈 Results:")
        print(f"   Total listings: {total_listings}")
        print(f"   Cost per listing: ${total_cost / total_listings:.4f}" if total_listings > 0 else "   No results")

        print(f"\n🔝 Most Expensive Platforms:")
        sorted_by_cost = sorted(results, key=lambda r: r.get("total_cost", 0), reverse=True)
        for i, r in enumerate(sorted_by_cost[:3], 1):
            if "error" not in r:
                print(f"   {i}. {r['platform']}: ${r['total_cost']:.4f} ({r['total_tokens']:,} tokens)")

        print(f"\n📊 Platform Breakdown:")
        for r in sorted(results, key=lambda x: x['platform']):
            if "error" not in r:
                print(f"   {r['platform']:12} → ${r['total_cost']:8.4f} ({r['total_tokens']:6,} tokens, {r['listings_found']} listings)")

        # Estimate for 10 platform search
        print(f"\n🎯 Extrapolation (10 platforms × 5 results each):")
        print(f"   Estimated max cost per search: ${total_cost * 2:.4f}")  # Rough 2x estimate for full 10-platform
        print(f"   Cost to sustain 100 searches: ${total_cost * 2 * 100:.2f}")
        print(f"   Cost to sustain 1000 searches: ${total_cost * 2 * 1000:.2f}")

        await self.client.aclose()

        return results


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Measure token usage and costs per platform")
    parser.add_argument("--query", default="gucci bag", help="Search query")
    parser.add_argument("--platforms", nargs="*", default=["all"], help="Platforms to test")
    args = parser.parse_args()

    measurer = TokenMeasurer()
    await measurer.measure_all(args.query, args.platforms)


if __name__ == "__main__":
    asyncio.run(main())
