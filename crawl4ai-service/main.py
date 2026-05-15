"""FastAPI sidecar that scrapes listing pages with crawl4ai.

Endpoint mirrors the ScrapedListing shape from lib/firecrawl.ts so the
Next.js route can delegate to this service with zero downstream changes.

Stub mode: when LLM_PROVIDER is empty (or its matching API key is missing),
the sidecar still fetches the page via Playwright and returns the page
metadata title, but leaves price/currency/isSold/condition/imageUrl as
nulls/defaults. This lets the rest of the pipeline be tested before an
LLM key is configured.
"""
from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

from extractors import LISTING_SCHEMA, get_crawler_options, get_extraction_options, get_prompt

# Load .env from parent directory (project root)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("crawl4ai-sidecar")

# Imported lazily inside lifespan so the module loads even before
# `crawl4ai-setup` has been run, making the error message friendlier.
crawler = None  # type: ignore[assignment]


# ── Provider / key resolution ────────────────────────────────────────────────

# Map litellm-style provider prefixes to the env-var holding their key.
_PROVIDER_KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "groq": "GROQ_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "ollama": None,  # local, no key required
}


def resolve_llm() -> Optional[tuple[str, Optional[str]]]:
    """Return (provider, api_key) if usable, else None (→ stub mode)."""
    provider = os.environ.get("LLM_PROVIDER", "").strip()
    if not provider:
        return None
    prefix = provider.split("/", 1)[0]
    key_env = _PROVIDER_KEY_ENV.get(prefix)
    if key_env is None:
        # Either unknown prefix (let litellm try anyway with no key) or ollama
        return provider, None
    api_key = os.environ.get(key_env, "").strip()
    if not api_key:
        log.warning("LLM_PROVIDER=%s set but %s is empty — running in stub mode", provider, key_env)
        return None
    return provider, api_key


# ── App lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global crawler
    from crawl4ai import AsyncWebCrawler, BrowserConfig

    # enable_stealth defeats the bot challenges on eBay (/splashui/challenge)
    # and StockX. user_agent_mode='random' avoids the static "HeadlessChrome" UA
    # that ebay-proxy-server uses as a tripwire.
    browser_cfg = BrowserConfig(
        headless=True,
        verbose=False,
        enable_stealth=True,
        user_agent_mode="random",
    )
    # NOTE: light_mode, text_mode, memory_saving_mode all break extraction on
    # React/Vue SPA sites (Grailed, Depop, StockX) by disrupting JS rendering
    # or producing empty chunk sections for the LLM strategy. Keep plain.
    crawler = AsyncWebCrawler(config=browser_cfg)
    await crawler.start()
    log.info("crawl4ai crawler started")
    try:
        yield
    finally:
        await crawler.close()
        log.info("crawl4ai crawler stopped")


app = FastAPI(lifespan=lifespan, title="fashion-crawler crawl4ai sidecar")


# ── Schemas ──────────────────────────────────────────────────────────────────

class ScrapeRequest(BaseModel):
    url: str
    platform: str


class ScrapedListing(BaseModel):
    url: str
    title: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    isSold: bool = False
    condition: Optional[str] = None
    imageUrl: Optional[str] = None


class ScrapeResponse(BaseModel):
    result: Optional[ScrapedListing] = None


# ── Coercion ─────────────────────────────────────────────────────────────────

def coerce_listing(url: str, raw: dict) -> ScrapedListing:
    """Mirror the lib/firecrawl.ts:119-127 coercion."""
    title = raw.get("title") if isinstance(raw.get("title"), str) else None
    price_val = raw.get("price")
    price = float(price_val) if isinstance(price_val, (int, float)) else None
    currency_val = raw.get("currency")
    currency = currency_val.upper() if isinstance(currency_val, str) and currency_val else "USD"
    is_sold = raw.get("isSold") is True
    condition = raw.get("condition") if isinstance(raw.get("condition"), str) else None
    image_url = raw.get("imageUrl") if isinstance(raw.get("imageUrl"), str) else None
    return ScrapedListing(
        url=url,
        title=title,
        price=price,
        currency=currency,
        isSold=is_sold,
        condition=condition,
        imageUrl=image_url,
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    llm = resolve_llm()
    return {
        "status": "ok",
        "llm_mode": "active" if llm else "stub",
        "provider": llm[0] if llm else None,
    }


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(req: ScrapeRequest) -> ScrapeResponse:
    from crawl4ai import CacheMode, CrawlerRunConfig
    from crawl4ai.extraction_strategy import LLMExtractionStrategy

    assert crawler is not None, "crawler not initialised"

    platform_opts = get_crawler_options(req.platform)
    llm = resolve_llm()

    try:
        if llm is None:
            # Stub mode: fetch the page, return only the page title (if any).
            run_cfg = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                page_timeout=30_000,
                remove_overlay_elements=True,
                remove_consent_popups=True,
                **platform_opts,
            )
            result = await crawler.arun(url=req.url, config=run_cfg)
            if not result.success:
                log.warning("[stub] crawl failed for %s: %s", req.url, result.error_message)
                return ScrapeResponse(result=None)
            title = getattr(result, "metadata", {}).get("title") if getattr(result, "metadata", None) else None
            return ScrapeResponse(
                result=ScrapedListing(url=req.url, title=title if isinstance(title, str) else None),
            )

        provider, api_token = llm
        # crawl4ai >= 0.4 exposes LLMConfig; older versions accepted provider/api_token directly.
        try:
            from crawl4ai import LLMConfig as _LLMConfig
            llm_config = _LLMConfig(provider=provider, api_token=api_token)
        except ImportError:
            llm_config = None

        strategy_kwargs = dict(
            schema=LISTING_SCHEMA,
            extraction_type="schema",
            instruction=get_prompt(req.platform),
            apply_chunking=False,
        )
        strategy_kwargs.update(get_extraction_options(req.platform))
        if llm_config is not None:
            strategy_kwargs["llm_config"] = llm_config
        else:
            strategy_kwargs["provider"] = provider
            strategy_kwargs["api_token"] = api_token

        strategy = LLMExtractionStrategy(**strategy_kwargs)
        run_cfg = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            page_timeout=30_000,
            remove_overlay_elements=True,
            remove_consent_popups=True,
            extraction_strategy=strategy,
            **platform_opts,
        )
        result = await crawler.arun(url=req.url, config=run_cfg)

        if not result.success or not result.extracted_content:
            log.warning("[llm] no extracted content for %s", req.url)
            return ScrapeResponse(result=None)

        # extracted_content is typically a JSON string (or a list of objects)
        raw = result.extracted_content
        if isinstance(raw, str):
            parsed = json.loads(raw)
        else:
            parsed = raw
        if isinstance(parsed, list):
            parsed = parsed[0] if parsed else {}
        if not isinstance(parsed, dict):
            log.warning("[llm] unexpected payload shape for %s: %r", req.url, type(parsed))
            return ScrapeResponse(result=None)

        return ScrapeResponse(result=coerce_listing(req.url, parsed))

    except Exception as exc:  # noqa: BLE001 — match firecrawl.ts swallow-and-null behaviour
        log.exception("scrape failed for %s: %s", req.url, exc)
        return ScrapeResponse(result=None)
