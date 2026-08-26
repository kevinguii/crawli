#!/usr/bin/env python3
"""Analyze token costs for searches across platforms.

This script runs actual searches via the API and estimates token usage
based on platform characteristics, HTML size, and response structure.

Usage:
    # Test single query across all platforms
    python scripts/token_cost_analysis.py

    # Test specific platforms
    python scripts/token_cost_analysis.py --platforms grailed depop poshmark

    # Test multiple queries
    python scripts/token_cost_analysis.py --queries "gucci bag" "nike shoes" "levis jeans"
"""

import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass, asdict
from typing import Optional
import httpx

SIDECAR_URL = os.getenv("CRAWL4AI_URL", "http://localhost:8000")
ALL_PLATFORMS = [
    "grailed", "depop", "poshmark", "mercari", "vinted",
    "thredup", "ebay", "vestiaire", "stockx"
    # "realreal"  # Disabled for now
]

# Pricing (May 2026); Firecrawl source of truth: docs/reference/FIRECRAWL_PRICING.md
GPT_4O_MINI_INPUT_PRICE = 0.15 / 1_000_000
GPT_4O_MINI_OUTPUT_PRICE = 0.60 / 1_000_000
# Hobby plan: $20/mo = 5,000 credits. Standard: $99/mo = 100,000 credits.
FIRECRAWL_PRICE_PER_CREDIT_HOBBY = 20 / 5000        # $0.004
FIRECRAWL_PRICE_PER_CREDIT_STANDARD = 99 / 100_000  # $0.00099
# Default to Hobby for "worst case" estimates; bake-off override available.
FIRECRAWL_PRICE_PER_CREDIT = FIRECRAWL_PRICE_PER_CREDIT_HOBBY

# Firecrawl search costs 2 credits per 10 results (rounded up). lib/firecrawl.ts
# currently hard-codes limit=20, so each platform-search = 4 credits.
FIRECRAWL_SEARCH_LIMIT = 20
FIRECRAWL_SEARCH_CREDITS_PER_PLATFORM = 2 * (FIRECRAWL_SEARCH_LIMIT // 10)  # = 4

# We DO NOT use Firecrawl for per-URL scrapes. crawl4ai (local Playwright)
# does the scraping; per-URL Firecrawl cost = 0. If we ever wire Firecrawl
# scrape in, basic = 1 credit/URL, +4 for JSON or stealth proxy.


@dataclass
class PlatformCost:
    platform: str
    query: str
    success: bool
    listings_found: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    firecrawl_credits: int = 0
    openai_cost: float = 0.0
    firecrawl_cost: float = 0.0
    total_cost: float = 0.0
    error: str = ""


class CostAnalyzer:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=120)
        # Platform-specific characteristics.
        # structured_capable: a deterministic JSON-LD / DOM extractor exists
        # in crawl4ai-service/structured_extractors.py, no LLM tokens used.
        # avg_html_chars: typical scraped HTML size, drives LLM input tokens
        # when structured_capable is False.
        # Firecrawl cost is NOT per-URL (Firecrawl only does search today).
        self.platform_chars = {
            "grailed":   {"avg_html_chars": 35000, "structured_capable": True},
            "depop":     {"avg_html_chars": 40000, "structured_capable": True},
            "poshmark":  {"avg_html_chars": 32000, "structured_capable": True},
            "mercari":   {"avg_html_chars": 28000, "structured_capable": True},
            "vinted":    {"avg_html_chars": 25000, "structured_capable": True},
            "stockx":    {"avg_html_chars": 35000, "structured_capable": True},
            "thredup":   {"avg_html_chars": 0,     "structured_capable": True},  # search-page grid, bypasses Firecrawl
            "ebay":      {"avg_html_chars": 50000, "structured_capable": False}, # LLM-only, chunked
            "vestiaire": {"avg_html_chars": 30000, "structured_capable": False}, # LLM-only
        }
        # Platforms that bypass Firecrawl entirely (sidecar /scrape-search).
        self.search_page_platforms = {"thredup", "realreal"}

    async def analyze_platform(
        self, platform: str, query: str
    ) -> PlatformCost:
        """Analyze token costs for a single platform."""
        print(f"  🔍 {platform:12}... ", end="", flush=True)

        try:
            # Call the search API
            async with httpx.AsyncClient(timeout=60) as c:
                resp = await c.post(
                    "http://localhost:3000/api/search",
                    json={"query": query, "platforms": [platform]},
                    headers={"Content-Type": "application/json"},
                )

            if resp.status_code != 200:
                raise Exception(f"HTTP {resp.status_code}")

            # Parse streaming NDJSON response
            listings = []
            lines = resp.text.strip().split("\n")
            for line in lines:
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    if event.get("type") == "platform_done" and event.get("status") == "ok":
                        listings.extend(event.get("listings", []))
                except json.JSONDecodeError:
                    continue

            # Estimate tokens based on platform characteristics
            chars = self.platform_chars.get(platform, {})
            html_chars = chars.get("avg_html_chars", 30000)

            # Token estimation: 1 token ≈ 4 characters average
            html_tokens_per_url = max(html_chars // 4, 0)
            num_urls_processed = len(listings) if listings else 5  # Assume 5 attempts

            # Firecrawl cost: search-only. Search-page platforms (ThredUp)
            # bypass Firecrawl entirely. Everything else pays 4 credits per
            # platform-search (limit=20 hard-coded in lib/firecrawl.ts).
            if platform in self.search_page_platforms:
                firecrawl_credits = 0
            else:
                firecrawl_credits = FIRECRAWL_SEARCH_CREDITS_PER_PLATFORM

            # OpenAI cost: only when structured extractor is missing.
            # Platforms with structured extractors → 0 LLM tokens.
            if chars.get("structured_capable"):
                input_tokens = 0
                output_tokens = 0
            elif platform == "ebay":
                # eBay markdown is ~50 KB and chunked into 3-4 segments,
                # so input tokens are ~2× the raw HTML/4 estimate.
                input_tokens = num_urls_processed * (html_tokens_per_url * 2 + 300)
                output_tokens = num_urls_processed * 150
            else:
                # Standard LLM extraction (Vestiaire, etc).
                input_tokens = num_urls_processed * (html_tokens_per_url + 300)
                output_tokens = num_urls_processed * 100

            openai_cost = (
                input_tokens * GPT_4O_MINI_INPUT_PRICE +
                output_tokens * GPT_4O_MINI_OUTPUT_PRICE
            )
            firecrawl_cost = firecrawl_credits * FIRECRAWL_PRICE_PER_CREDIT
            total_cost = openai_cost + firecrawl_cost

            print(
                f"✓ {len(listings):2} listings | "
                f"{input_tokens:5,} in-tokens | "
                f"${total_cost:.5f}"
            )

            return PlatformCost(
                platform=platform,
                query=query,
                success=True,
                listings_found=len(listings),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                firecrawl_credits=firecrawl_credits,
                openai_cost=openai_cost,
                firecrawl_cost=firecrawl_cost,
                total_cost=total_cost,
            )

        except Exception as e:
            print(f"✗ {str(e)[:50]}")
            return PlatformCost(
                platform=platform,
                query=query,
                success=False,
                error=str(e),
            )

    async def analyze_query(
        self, query: str, platforms: list[str] = None
    ) -> list[PlatformCost]:
        """Analyze costs for a query across platforms."""
        if platforms is None:
            platforms = ALL_PLATFORMS
        elif "all" in platforms:
            platforms = ALL_PLATFORMS

        print(f"\n📊 Analyzing: \"{query}\"")
        print("=" * 90)

        results = []
        for platform in platforms:
            result = await self.analyze_platform(platform, query)
            results.append(result)

        return results

    def print_summary(self, results: list[PlatformCost]):
        """Print cost summary."""
        successful = [r for r in results if r.success]
        if not successful:
            print("\n❌ No successful results to summarize")
            return

        total_cost = sum(r.total_cost for r in successful)
        total_input = sum(r.input_tokens for r in successful)
        total_output = sum(r.output_tokens for r in successful)
        total_listings = sum(r.listings_found for r in successful)
        total_credits = sum(r.firecrawl_credits for r in successful)

        print("\n" + "=" * 90)
        print("💰 COST SUMMARY")
        print("=" * 90)

        print(f"\n📈 Results:")
        print(f"   Platforms searched: {len(successful)}/{len(results)}")
        print(f"   Total listings: {total_listings}")
        if total_listings > 0:
            print(f"   Cost per listing: ${total_cost / total_listings:.6f}")

        print(f"\n🔢 Tokens:")
        print(f"   Input tokens: {total_input:,}")
        print(f"   Output tokens: {total_output:,}")
        print(f"   Total: {total_input + total_output:,}")

        openai_total = sum(r.openai_cost for r in successful)
        firecrawl_total = sum(r.firecrawl_cost for r in successful)

        print(f"\n💵 Costs:")
        print(f"   OpenAI (GPT-4o-mini): ${openai_total:.6f} ({total_input + total_output:,} tokens)")
        print(f"   Firecrawl: ${firecrawl_total:.6f} ({total_credits:,} credits)")
        print(f"   TOTAL: ${total_cost:.6f}")

        print(f"\n🔝 Most Expensive Platforms:")
        sorted_by_cost = sorted(successful, key=lambda r: r.total_cost, reverse=True)
        for i, r in enumerate(sorted_by_cost[:3], 1):
            pct = (r.total_cost / total_cost * 100) if total_cost > 0 else 0
            print(f"   {i}. {r.platform:12} ${r.total_cost:.6f} ({pct:5.1f}%)")

        print(f"\n📊 Per-Platform Breakdown:")
        print(f"   {'Platform':12} | {'Listings':8} | {'In-Tokens':10} | {'Out-Tokens':10} | {'Cost':10}")
        print("   " + "-" * 75)
        for r in sorted(successful, key=lambda x: x.platform):
            print(
                f"   {r.platform:12} | {r.listings_found:8} | "
                f"{r.input_tokens:10,} | {r.output_tokens:10,} | "
                f"${r.total_cost:9.6f}"
            )

        # Extrapolation for 10 platforms
        print(f"\n🎯 Extrapolation (Full 10-Platform Search):")
        estimated_per_search = total_cost * 1.5  # 1.5x for missing/failed platforms
        print(f"   Cost per search: ${estimated_per_search:.6f}")
        print(f"   Cost for 100 searches: ${estimated_per_search * 100:.2f}")
        print(f"   Cost for 1,000 searches: ${estimated_per_search * 1000:.2f}")
        print(f"   Daily cost (100 searches): ${estimated_per_search * 100:.2f}")
        print(f"   Monthly cost (3,000 searches): ${estimated_per_search * 3000:.2f}")

        return {
            "total_cost": total_cost,
            "per_search": estimated_per_search,
        }


async def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Analyze token costs for searches across platforms"
    )
    parser.add_argument(
        "--queries",
        nargs="*",
        default=["gucci bag"],
        help="Queries to test",
    )
    parser.add_argument(
        "--platforms",
        nargs="*",
        default=["all"],
        help="Platforms to test (default: all)",
    )
    args = parser.parse_args()

    analyzer = CostAnalyzer()
    all_results = []

    for query in args.queries:
        results = await analyzer.analyze_query(query, args.platforms)
        all_results.extend(results)
        analyzer.print_summary(results)

    await analyzer.client.aclose()

    # Return summary for scripting
    if all_results:
        successful = [r for r in all_results if r.success]
        if successful:
            total = sum(r.total_cost for r in successful)
            print(f"\n✅ Grand total: ${total:.6f}")


if __name__ == "__main__":
    asyncio.run(main())
