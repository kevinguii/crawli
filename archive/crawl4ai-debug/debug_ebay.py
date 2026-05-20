"""Fetch an eBay listing via crawl4ai and report what content Playwright actually
sees. If the markdown is short / empty / contains "robot check", we have a bot
detection issue. Otherwise the LLM extraction step is the problem."""
import asyncio
import sys


async def main(url: str) -> None:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

    browser_cfg = BrowserConfig(headless=True, verbose=False)
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        result = await crawler.arun(
            url=url,
            config=CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                page_timeout=40_000,
                word_count_threshold=0,
            ),
        )
        if not result.success:
            print(f"FAILED: {result.error_message}")
            return

        md = result.markdown or ""
        print(f"URL:           {url}")
        print(f"Markdown len:  {len(md)} chars")
        print(f"Status code:   {getattr(result, 'status_code', 'n/a')}")
        print()
        print("── First 500 chars of markdown ──")
        print(md[:500])
        print()
        print("── Bot-detection signals ──")
        for marker in ["robot check", "captcha", "verify you are", "unusual activity", "blocked"]:
            if marker.lower() in md.lower():
                print(f"  ⚠️  Found '{marker}' in markdown")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.ebay.com/itm/166231615695"
    asyncio.run(main(url))
