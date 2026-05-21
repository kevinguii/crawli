"""FastAPI sidecar that scrapes listing pages with crawl4ai.

Endpoint mirrors the ScrapedListing shape from lib/firecrawl.ts so the
Next.js route can delegate to this service with zero downstream changes.

Two-tier extraction:
  1. CSS-first: read Open Graph product metadata (deterministic, no LLM).
  2. LLM fallback: scoped to platform-specific main content via target_elements.

Stub mode: when LLM_PROVIDER is empty (or its matching API key is missing),
the sidecar still fetches the page via Playwright and returns the page
metadata title, but leaves price/currency/isSold/condition/imageUrl as
nulls/defaults. This lets the rest of the pipeline be tested before an
LLM key is configured.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import threading
from contextlib import asynccontextmanager
from typing import Optional
from urllib.parse import urlparse, urlunparse

from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from extractors import (
    LISTING_SCHEMA,
    get_crawler_options,
    get_extraction_options,
    get_prompt,
)
from structured_extractors import PLATFORM_EXTRACTORS, extract_structured
from search_page_extractors import (
    SEARCH_PAGE_PLATFORMS,
    extract_search_grid,
    search_url_for,
)

# Load .env from parent directory (project root)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("crawl4ai-sidecar")

# Imported lazily inside lifespan so the module loads even before
# `crawl4ai-setup` has been run, making the error message friendlier.
crawler = None  # type: ignore[assignment]

# Per-platform crawler instances that need a different BrowserConfig than the
# default (e.g. The RealReal needs a managed-browser profile + UndetectedAdapter
# to slip past PerimeterX). Lazily started on first use, closed in lifespan().
_platform_crawlers: dict[str, "object"] = {}
# Platforms whose first request needs a non-guarded warmup URL to set
# anti-bot cookies before navigating to the actual search URL.
_platform_warmed: set[str] = set()

THEREALREAL_PROFILE_DIR = os.path.expanduser("~/.crawl4ai/profiles/therealreal")
THEREALREAL_WARMUP_URL = "https://www.therealreal.com/"


# ── Concurrency / driver-health state ────────────────────────────────────────
# A1: global cap on simultaneous crawler.arun() calls. Defends a single
# Chromium against the all-platforms-at-once fan-out from the Next route.
# Env-driven so production can scale it with the box; default tuned for an
# 8 GB laptop. See .env.example for per-host recommendations.
SIDECAR_MAX_CONCURRENT_RENDERS = max(1, int(os.environ.get("SIDECAR_MAX_CONCURRENT_RENDERS", "6")))

# Semaphore + restart lock are initialised in lifespan() (asyncio primitives
# must bind to the running loop).
_render_semaphore: Optional[asyncio.Semaphore] = None
_restart_lock: Optional[asyncio.Lock] = None
_restart_task: Optional[asyncio.Task] = None

# A2: when the Playwright driver subprocess dies, every subsequent
# BrowserContext.new_page() returns one of these error strings instantly.
# Detecting them lets the sidecar short-circuit instead of piling requests
# onto a corpse.
_DRIVER_DEAD_PATTERNS = (
    "the handler is closed",
    "Connection closed while reading from the driver",
    "WriteUnixTransport closed",
)
_driver_dead: bool = False


def _looks_like_driver_death(error_message: Optional[str]) -> bool:
    if not error_message:
        return False
    return any(pat in error_message for pat in _DRIVER_DEAD_PATTERNS)


async def _restart_crawler_once() -> None:
    """A3: rebuild the global crawler after a driver-subprocess death.

    Guarded by `_restart_lock` so concurrent observers all wait on the same
    recovery rather than each spawning their own. If `start()` fails the
    flag stays True so the next request retries — we never crash the
    FastAPI process trying to recover.
    """
    global crawler, _driver_dead
    assert _restart_lock is not None
    async with _restart_lock:
        if not _driver_dead:
            return
        log.warning("[crawler] driver dead — restarting Chromium")
        try:
            if crawler is not None:
                await crawler.close()
        except Exception:  # noqa: BLE001 — close may itself error on a dead pipe
            log.exception("[crawler] close errored during restart (continuing)")
        try:
            from crawl4ai import AsyncWebCrawler, BrowserConfig
            browser_cfg = BrowserConfig(
                headless=True,
                verbose=False,
                enable_stealth=True,
                user_agent_mode="random",
            )
            crawler = AsyncWebCrawler(config=browser_cfg)
            await crawler.start()
            _driver_dead = False
            log.info("[crawler] restart complete")
        except Exception:  # noqa: BLE001
            log.exception("[crawler] restart failed — will retry on next request")


def _trigger_restart_in_background() -> None:
    """Fire-and-forget the recovery coroutine. Idempotent — extra calls
    bounce off the lock without spawning duplicate tasks."""
    global _restart_task
    if _restart_task is None or _restart_task.done():
        try:
            _restart_task = asyncio.create_task(_restart_crawler_once())
        except RuntimeError:
            # No running loop (e.g. called outside async context) — let the
            # next request trigger it.
            pass


def _mark_driver_dead(error_message: str) -> None:
    """Set the dead flag and kick off restart. Called once we see the
    'handler is closed' family of errors on a crawler.arun() result."""
    global _driver_dead
    if not _driver_dead:
        log.error("[crawler] detected driver death: %s", error_message[:200])
    _driver_dead = True
    _trigger_restart_in_background()


# A6: response caches for /scrape (per URL) and /scrape-search (per
# platform+query). Cache hits skip Playwright + LLM entirely — same load
# surface as the semaphore, from the demand side. Misses are NOT cached so
# transient failures can retry; only successful, non-empty results land here.
_scrape_cache: TTLCache = TTLCache(maxsize=500, ttl=1800)   # 30 min per URL
_search_cache: TTLCache = TTLCache(maxsize=200, ttl=600)    # 10 min per (platform, query)
_cache_lock = threading.Lock()


# ── Provider / key resolution ────────────────────────────────────────────────

_PROVIDER_KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "groq": "GROQ_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "ollama": None,
}


def resolve_llm() -> Optional[tuple[str, Optional[str]]]:
    """Return (provider, api_key) if usable, else None (→ stub mode)."""
    provider = os.environ.get("LLM_PROVIDER", "").strip()
    if not provider:
        return None
    prefix = provider.split("/", 1)[0]
    key_env = _PROVIDER_KEY_ENV.get(prefix)
    if key_env is None:
        return provider, None
    api_key = os.environ.get(key_env, "").strip()
    if not api_key:
        log.warning("LLM_PROVIDER=%s set but %s is empty — running in stub mode", provider, key_env)
        return None
    return provider, api_key


# ── App lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global crawler, _render_semaphore, _restart_lock
    from crawl4ai import AsyncWebCrawler, BrowserConfig

    # Bind asyncio primitives to the running event loop.
    _render_semaphore = asyncio.Semaphore(SIDECAR_MAX_CONCURRENT_RENDERS)
    _restart_lock = asyncio.Lock()

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
    log.info("crawl4ai crawler started (max_concurrent_renders=%d)", SIDECAR_MAX_CONCURRENT_RENDERS)
    try:
        yield
    finally:
        await crawler.close()
        for plat, c in list(_platform_crawlers.items()):
            try:
                await c.close()
                log.info("crawl4ai crawler stopped (platform=%s)", plat)
            except Exception:  # noqa: BLE001
                log.exception("error closing platform crawler %s", plat)
        _platform_crawlers.clear()
        _platform_warmed.clear()
        log.info("crawl4ai crawler stopped")


async def _ensure_realreal_crawler():
    """Lazily start a TRR-dedicated crawler with managed profile + UndetectedAdapter.

    TRR is gated by PerimeterX. The default stealth adapter is detected; the
    UndetectedAdapter bundled with crawl4ai 0.8.x is the supported workaround.
    The managed-browser profile (created via `crwl profiles create therealreal`)
    persists session cookies + the resolved _px* tokens, so once the user has
    solved the press-and-hold challenge once, subsequent restarts reuse them.
    """
    if "realreal" in _platform_crawlers:
        return _platform_crawlers["realreal"]
    if not os.path.isdir(THEREALREAL_PROFILE_DIR):
        log.warning(
            "[realreal] profile dir missing (%s). Run `crwl profiles create therealreal` "
            "and log in interactively before searching The RealReal.",
            THEREALREAL_PROFILE_DIR,
        )
        return None

    from crawl4ai import AsyncWebCrawler, BrowserConfig, UndetectedAdapter
    from crawl4ai.async_crawler_strategy import AsyncPlaywrightCrawlerStrategy

    cfg = BrowserConfig(
        headless=False,  # UndetectedAdapter + PX are far less reliable headless
        use_managed_browser=True,
        user_data_dir=THEREALREAL_PROFILE_DIR,
        enable_stealth=False,  # UndetectedAdapter supersedes stealth; don't double up
        verbose=False,
    )
    strategy = AsyncPlaywrightCrawlerStrategy(
        browser_config=cfg,
        browser_adapter=UndetectedAdapter(),
    )
    c = AsyncWebCrawler(crawler_strategy=strategy)
    await c.start()
    _platform_crawlers["realreal"] = c
    log.info("[realreal] dedicated crawler started (managed profile + UndetectedAdapter)")
    return c


async def _warmup_realreal(c) -> None:
    """One-time warmup nav so PerimeterX cookies are minted before /products?keywords=.

    /products is PX-guarded but the homepage isn't. The first nav of a fresh
    browser may still surface a press-and-hold challenge that the user needs to
    solve manually; the resolved cookies persist in the managed profile so
    later sessions skip it.
    """
    if "realreal" in _platform_warmed:
        return
    from crawl4ai import CacheMode, CrawlerRunConfig
    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=90_000,
        wait_until="domcontentloaded",
        # Long warmup so the user has time to interact with any press-and-hold
        # PX challenge that appears in the visible Chromium window.
        delay_before_return_html=20.0,
        remove_overlay_elements=False,
        remove_consent_popups=True,
    )
    log.info("[realreal] warmup nav → %s (20s — solve any press-and-hold in the Chromium window)", THEREALREAL_WARMUP_URL)
    try:
        assert _render_semaphore is not None
        async with _render_semaphore:
            warmup_result = await c.arun(url=THEREALREAL_WARMUP_URL, config=cfg)
        if warmup_result is not None and _looks_like_driver_death(getattr(warmup_result, "error_message", None)):
            _mark_driver_dead(warmup_result.error_message or "")
            return
    except Exception:  # noqa: BLE001
        log.exception("[realreal] warmup failed (will retry on next request)")
        return
    _platform_warmed.add("realreal")
    log.info("[realreal] warmup complete; PX cookies should be set")


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


class ScrapeSearchRequest(BaseModel):
    platform: str
    query: str
    limit: int = 12


class ScrapeSearchResponse(BaseModel):
    results: list[ScrapedListing] = []


class RefreshPriceRequest(BaseModel):
    url: str
    platform: str


class RefreshPriceResponse(BaseModel):
    price: Optional[float] = None
    isSold: bool = False
    fetched: bool = False
    tier: Optional[str] = None  # 'http' | 'playwright' | 'llm' | None


# ── Coercion ─────────────────────────────────────────────────────────────────

_NUM_RE = re.compile(r"-?\d+(?:[\.,]\d+)?")


def _parse_price(value) -> Optional[float]:
    """Accept int, float, or string with currency symbol/commas/whitespace."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        m = _NUM_RE.search(value.replace(",", ""))
        if m:
            try:
                return float(m.group(0))
            except ValueError:
                return None
    return None


def coerce_listing(url: str, raw: dict) -> ScrapedListing:
    title = raw.get("title") if isinstance(raw.get("title"), str) else None
    price = _parse_price(raw.get("price"))
    currency_val = raw.get("currency")
    currency = currency_val.upper() if isinstance(currency_val, str) and currency_val else "USD"
    is_sold = raw.get("isSold") is True
    # Derive isSold from OG availability when present.
    avail = raw.get("availability")
    if isinstance(avail, str):
        lower = avail.lower()
        if any(token in lower for token in ("oos", "out of stock", "sold", "discontinued")):
            is_sold = True
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


# ── Crawl helpers ────────────────────────────────────────────────────────────

_POSHMARK_NAV_ERROR = "Unable to retrieve content because the page is navigating"


def _build_run_cfg(platform: str, *, extraction_strategy=None, attempt: int = 1, scope_to_target: bool = False):
    """Build a CrawlerRunConfig with platform-specific tuning.

    scope_to_target: when True, apply target_elements from
    PLATFORM_CRAWLER_OPTIONS so the LLM only sees the main product container.
    When False (CSS tier), keep full HTML so <head> meta tags survive.
    """
    from crawl4ai import CacheMode, CrawlerRunConfig

    platform_opts = dict(get_crawler_options(platform))
    if not scope_to_target:
        platform_opts.pop("target_elements", None)

    # All target sites are React/Vue SPAs: the main product card paints
    # several seconds after DOMContentLoaded. 1.5s is far too short (Depop's
    # JSON-LD Product block hadn't rendered) and caused the LLM to pick prices
    # from the "More from seller" / related-items rails. 5s + domcontentloaded
    # is empirically enough on Depop/StockX/Grailed/Poshmark.
    #
    # CRITICAL: remove_overlay_elements=False. Crawl4ai runs JS in the page to
    # remove overlay nodes; on Poshmark this either triggers a navigation or
    # mutates the DOM such that the resulting HTML loses <meta property="og:type">
    # and other key signals (verified 2026-05-15: with overlay-removal ON the
    # sold listing's og:type=product disappears and the structured extractor
    # falls through to a hallucinating LLM). Side benefit: eliminates the
    # "Failed to remove overlay elements: Execution context was destroyed"
    # warning and the cascading "Page.content: page is navigating" errors.
    cfg_kwargs = dict(
        cache_mode=CacheMode.BYPASS,
        page_timeout=45_000,
        wait_until="domcontentloaded",
        delay_before_return_html=5.0,
        remove_overlay_elements=False,
        remove_consent_popups=True,
    )

    # Poshmark redirects mid-load (login wall / locale wall). Be even more
    # generous so Page.content() lands on a stable document.
    if platform == "poshmark":
        cfg_kwargs["page_timeout"] = 50_000
        cfg_kwargs["delay_before_return_html"] = 6.0
    # The RealReal sits behind PerimeterX. A press-and-hold challenge can
    # appear on first nav after profile re-use; the user needs time to
    # interact with the visible Chromium window. 20s is generous enough for
    # manual hold + auto-resolve afterwards.
    if platform == "realreal":
        cfg_kwargs["page_timeout"] = 90_000
        cfg_kwargs["delay_before_return_html"] = 20.0
    # On retry, be more patient regardless of platform.
    if attempt > 1:
        cfg_kwargs["page_timeout"] = 60_000
        cfg_kwargs["delay_before_return_html"] = 7.0

    if extraction_strategy is not None:
        cfg_kwargs["extraction_strategy"] = extraction_strategy

    cfg_kwargs.update(platform_opts)
    return CrawlerRunConfig(**cfg_kwargs)


async def _arun_with_retry(url: str, platform: str, *, extraction_strategy=None, scope_to_target: bool = False, crawler_override=None):
    """Run a crawl; on Poshmark-style navigation errors, retry once.

    crawler_override: optional per-platform crawler (e.g. realreal's managed-profile
    instance). When None, the global default crawler is used.

    A1+A2: every arun() call goes through `_render_semaphore`, and the result's
    error_message is scanned for "handler is closed" / "Connection closed while
    reading from the driver" so a dead driver subprocess flips `_driver_dead`
    and triggers background recovery instead of being retried into the corpse.
    """
    c = crawler_override if crawler_override is not None else crawler
    assert c is not None
    assert _render_semaphore is not None
    cfg = _build_run_cfg(platform, extraction_strategy=extraction_strategy, attempt=1, scope_to_target=scope_to_target)
    async with _render_semaphore:
        result = await c.arun(url=url, config=cfg)
    err = (result.error_message or "") if result is not None else ""
    if _looks_like_driver_death(err):
        _mark_driver_dead(err)
        return result
    if (not result.success or _POSHMARK_NAV_ERROR in err) and platform == "poshmark":
        log.info("[retry] poshmark crawl hit navigation error, retrying with networkidle wait")
        cfg = _build_run_cfg(platform, extraction_strategy=extraction_strategy, attempt=2, scope_to_target=scope_to_target)
        async with _render_semaphore:
            result = await c.arun(url=url, config=cfg)
        err = (result.error_message or "") if result is not None else ""
        if _looks_like_driver_death(err):
            _mark_driver_dead(err)
    return result


def _try_structured_extract(platform: str, html: str) -> Optional[dict]:
    """Run platform-specific structured extractor (JSON-LD or testid CSS).

    Returns a dict on hit, None on miss → caller falls back to LLM.
    Special case: StockX may return a dict with price=None when the listing
    legitimately has no Lowest Ask; that IS a valid result (don't fall back).
    """
    if not html:
        return None
    try:
        return extract_structured(platform, html)
    except Exception as exc:  # noqa: BLE001
        log.warning("[structured] %s extractor error: %s", platform, exc)
        return None


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    llm = resolve_llm()
    return {
        "status": "ok",
        "llm_mode": "active" if llm else "stub",
        "provider": llm[0] if llm else None,
        # A4: distinguish "FastAPI up" from "Chromium up". When the
        # Playwright driver dies this flips to False until auto-restart
        # finishes (~5s).
        "crawler_alive": not _driver_dead,
        "max_concurrent_renders": SIDECAR_MAX_CONCURRENT_RENDERS,
    }


# Helper for the three scrape endpoints. Returns a JSONResponse with HTTP 503
# when the driver is dead so the caller doesn't queue requests onto a corpse.
# Triggers the background restart in the same call so recovery starts ASAP.
def _driver_dead_response(endpoint: str) -> Optional[JSONResponse]:
    if _driver_dead:
        _trigger_restart_in_background()
        log.warning("[%s] short-circuit 503 — driver dead, restart in progress", endpoint)
        return JSONResponse(
            status_code=503,
            content={"error": "sidecar restarting", "endpoint": endpoint},
        )
    return None


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(req: ScrapeRequest):
    from crawl4ai.extraction_strategy import LLMExtractionStrategy

    dead = _driver_dead_response("scrape")
    if dead is not None:
        return dead

    assert crawler is not None, "crawler not initialised"

    # ThredUp URLs from the search-page extractor carry ?query_id=&result_id=
    # tracking params that trigger a server-side redirect. Playwright races
    # Page.content() against that redirect and throws "page is navigating".
    # Strip all query params for ThredUp — the product ID in the path is enough.
    if req.platform == "thredup":
        parsed = urlparse(req.url)
        req = req.model_copy(update={"url": urlunparse(parsed._replace(query="", fragment=""))})

    # A6: response cache check. Keyed by canonical URL (post-ThredUp-strip).
    # Cache survives induced driver death — if we have a hit, we serve it
    # without ever touching the crawler.
    cache_key = req.url
    with _cache_lock:
        cached = _scrape_cache.get(cache_key)
    if cached is not None:
        log.info("[cache] hit for %s", req.url)
        return ScrapeResponse(result=cached)

    llm = resolve_llm()

    try:
        # ── Tier 1: structured-data extraction (JSON-LD / testid CSS) ───────
        # Verified empirically: Depop/Grailed/Poshmark emit Schema.org
        # JSON-LD with offers.price; StockX exposes Lowest Ask via
        # data-testid="trade-box-buy-amount" (None means no Ask available —
        # that's a valid result, don't fall back to LLM and risk a guess).
        if req.platform in PLATFORM_EXTRACTORS:
            result = await _arun_with_retry(req.url, req.platform)
            if result.success:
                # Prefer raw HTML — cleaned_html may strip <script> tags that
                # carry JSON-LD product data.
                raw_html = getattr(result, "html", None) or getattr(result, "cleaned_html", None) or ""
                extracted = _try_structured_extract(req.platform, raw_html)
                if extracted is not None:
                    # StockX legitimately returns price=None for no-Ask listings.
                    # Other platforms only return non-None if they found a price.
                    log.info("[structured] hit for %s (price=%s)", req.url, extracted.get("price"))
                    listing = coerce_listing(req.url, extracted)
                    with _cache_lock:
                        _scrape_cache[cache_key] = listing
                    return ScrapeResponse(result=listing)
                log.info("[structured] miss for %s — falling back to LLM", req.url)
            else:
                log.warning("[structured] crawl failed for %s: %s", req.url, result.error_message)

        # ── Tier 2: LLM extraction (or stub) ─────────────────────────────────
        if llm is None:
            # Stub mode: fetch + return only the page title.
            result = await _arun_with_retry(req.url, req.platform)
            if not result.success:
                log.warning("[stub] crawl failed for %s: %s", req.url, result.error_message)
                return ScrapeResponse(result=None)
            title = getattr(result, "metadata", {}).get("title") if getattr(result, "metadata", None) else None
            return ScrapeResponse(
                result=ScrapedListing(url=req.url, title=title if isinstance(title, str) else None),
            )

        provider, api_token = llm
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
        result = await _arun_with_retry(req.url, req.platform, extraction_strategy=strategy, scope_to_target=True)

        # Token usage logging, default-off (TOKEN_TRACKING=1 to enable).
        try:
            from token_tracker import log_extraction, is_enabled
            if is_enabled():
                log_extraction(
                    platform=req.platform,
                    url=req.url,
                    strategy=strategy,
                    model=provider,
                )
        except Exception as _exc:  # noqa: BLE001 — tracking must never break scraping
            log.debug("token_tracker log_extraction failed: %s", _exc)

        if not result.success or not result.extracted_content:
            log.warning("[llm] no extracted content for %s", req.url)
            return ScrapeResponse(result=None)

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

        listing = coerce_listing(req.url, parsed)
        with _cache_lock:
            _scrape_cache[cache_key] = listing
        return ScrapeResponse(result=listing)

    except Exception as exc:  # noqa: BLE001 — match firecrawl.ts swallow-and-null behaviour
        log.exception("scrape failed for %s: %s", req.url, exc)
        return ScrapeResponse(result=None)


@app.post("/scrape-search", response_model=ScrapeSearchResponse)
async def scrape_search(req: ScrapeSearchRequest):
    """Render a platform's onsite search page and pull a grid of listings.

    Used for platforms (e.g. ThredUp, The RealReal) whose individual listing URLs
    aren't discoverable via Firecrawl's `site:` search — instead, every listing
    card on the search page carries the data we need (price, image, title, URL).
    """
    dead = _driver_dead_response("scrape-search")
    if dead is not None:
        return dead

    assert crawler is not None, "crawler not initialised"

    if req.platform not in SEARCH_PAGE_PLATFORMS:
        log.warning("[scrape-search] unsupported platform: %s", req.platform)
        return ScrapeSearchResponse(results=[])

    # A6: cache by (platform, normalized query). Same render is re-requested
    # every time someone types the same search — watchlist refresh and back-
    # nav hammer this without it.
    cache_key = f"{req.platform}::{req.query.strip().lower()}"
    with _cache_lock:
        cached = _search_cache.get(cache_key)
    if cached is not None:
        log.info("[cache] search hit for %s/%s (%d results)", req.platform, req.query, len(cached))
        return ScrapeSearchResponse(results=cached)

    target_url = search_url_for(req.platform, req.query)
    if not target_url:
        return ScrapeSearchResponse(results=[])

    # Route TRR through its managed-profile crawler with warmup.
    crawler_override = None
    if req.platform == "realreal":
        # TRR is DEFERRED — PerimeterX press-and-hold defeats UndetectedAdapter
        # + managed profile in our toolkit. See HANDOFF §7 (G). Set
        # REALREAL_ENABLED=1 in .env to re-attempt (e.g. after upgrading crawl4ai
        # or adding a CAPTCHA-solving provider).
        if not os.environ.get("REALREAL_ENABLED"):
            log.info("[realreal] search skipped — deferred (set REALREAL_ENABLED=1 to retry)")
            return ScrapeSearchResponse(results=[])
        crawler_override = await _ensure_realreal_crawler()
        if crawler_override is None:
            return ScrapeSearchResponse(results=[])
        await _warmup_realreal(crawler_override)

    try:
        result = await _arun_with_retry(target_url, req.platform, crawler_override=crawler_override)

        # For TRR, crawl4ai's anti-bot detector flags the real 2MB /products
        # response as a false-positive 403 (it triggers on a sub-resource header).
        # We trust the HTML body if __NEXT_DATA__ extraction yields edges; the
        # extractor's own log will warn if the page is actually a PX captcha
        # (no __NEXT_DATA__).
        if not result.success and req.platform != "realreal":
            log.warning("[scrape-search] crawl failed for %s: %s", target_url, result.error_message)
            return ScrapeSearchResponse(results=[])

        raw_html = getattr(result, "html", None) or getattr(result, "cleaned_html", None) or ""
        items = extract_search_grid(req.platform, raw_html, limit=req.limit)
        listings = [coerce_listing(item["url"], item) for item in items if isinstance(item.get("url"), str)]

        if req.platform == "realreal" and not listings:
            # First request after press-and-hold timeout may still be the PX
            # captcha page. Force a re-warmup so the next request resolves.
            _platform_warmed.discard("realreal")
            # Dump the captured HTML so we can inspect what we got (captcha vs
            # real page with missing keys). Truncated at 200KB to keep disk
            # usage bounded.
            try:
                dump_dir = os.path.join(os.path.dirname(__file__), "debug_dumps")
                os.makedirs(dump_dir, exist_ok=True)
                with open(os.path.join(dump_dir, "realreal-last-empty.html"), "w", encoding="utf-8") as fh:
                    fh.write(raw_html[:200_000])
                log.warning(
                    "[realreal] zero listings — dumped HTML to debug_dumps/realreal-last-empty.html "
                    "(size=%d bytes, success=%s)",
                    len(raw_html),
                    result.success,
                )
            except Exception:  # noqa: BLE001
                log.exception("[realreal] failed to dump empty HTML")

        log.info("[scrape-search] %s '%s' → %d listings", req.platform, req.query, len(listings))
        # Only cache non-empty results — empty likely means transient failure
        # (e.g. PerimeterX, rate-limit) that we want to retry next time.
        if listings:
            with _cache_lock:
                _search_cache[cache_key] = listings
        return ScrapeSearchResponse(results=listings)
    except Exception as exc:  # noqa: BLE001
        log.exception("[scrape-search] failed for %s '%s': %s", req.platform, req.query, exc)
        return ScrapeSearchResponse(results=[])


# ── /refresh-price ───────────────────────────────────────────────────────────

_REFRESH_HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


def _refresh_result_from_extracted(extracted: dict, tier: str) -> RefreshPriceResponse:
    """Coerce a structured/LLM extractor dict into the narrow refresh response."""
    price = _parse_price(extracted.get("price"))
    is_sold = extracted.get("isSold") is True
    avail = extracted.get("availability")
    if isinstance(avail, str):
        lower = avail.lower()
        if any(token in lower for token in ("oos", "out of stock", "sold", "discontinued")):
            is_sold = True
    # fetched=true when we actually got a definitive signal (price OR confirmed sold)
    fetched = price is not None or is_sold
    return RefreshPriceResponse(price=price, isSold=is_sold, fetched=fetched, tier=tier if fetched else None)


@app.post("/refresh-price", response_model=RefreshPriceResponse)
async def refresh_price(req: RefreshPriceRequest):
    """Watchlist-refresh-only path: fetch a single listing URL and return
    just price + isSold. Tiered for accuracy:
      1. httpx GET → structured extract  (fast, works for SSR'd platforms)
      2. Playwright → structured extract (handles Cloudflare / JS-rendered)
      3. LLM extract on best HTML        (final safety net, matches /scrape)
    Returns price=None, isSold=False, fetched=False if all tiers miss.
    The caller still bumps last_checked_at so the UI shows the attempt.

    No response cache here: watchlist refresh is explicitly the "go re-check
    prices now" path. Caching would defeat the purpose.
    """
    dead = _driver_dead_response("refresh-price")
    if dead is not None:
        return dead

    assert crawler is not None, "crawler not initialised"

    # Defensive: strip tracking params for ThredUp (server-side redirects on these).
    url = req.url
    if req.platform == "thredup":
        parsed = urlparse(url)
        url = urlunparse(parsed._replace(query="", fragment=""))

    best_html: str = ""  # keep around for Tier 3 LLM fallback

    # ── Tier 1: plain HTTP ─────────────────────────────────────────────────
    try:
        import httpx
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=10.0,
            headers=_REFRESH_HTTP_HEADERS,
        ) as client:
            http_resp = await client.get(url)
        if http_resp.status_code == 200 and http_resp.text:
            best_html = http_resp.text
            extracted = _try_structured_extract(req.platform, best_html)
            if extracted is not None and (extracted.get("price") is not None or extracted.get("isSold")):
                log.info("[refresh-price] http hit %s %s", req.platform, url)
                return _refresh_result_from_extracted(extracted, "http")
            log.info("[refresh-price] http miss (no price) %s %s", req.platform, url)
        else:
            log.info("[refresh-price] http miss (status=%s) %s %s", http_resp.status_code, req.platform, url)
    except Exception as exc:  # noqa: BLE001
        log.info("[refresh-price] http error %s %s: %s", req.platform, url, exc)

    # ── Tier 2: Playwright + structured ────────────────────────────────────
    pw_html: str = ""
    try:
        result = await _arun_with_retry(url, req.platform)
        if result is not None and result.success:
            pw_html = getattr(result, "html", None) or getattr(result, "cleaned_html", None) or ""
            if pw_html:
                best_html = pw_html  # prefer rendered HTML for LLM tier
            extracted = _try_structured_extract(req.platform, pw_html)
            if extracted is not None and (extracted.get("price") is not None or extracted.get("isSold")):
                log.info("[refresh-price] playwright hit %s %s", req.platform, url)
                return _refresh_result_from_extracted(extracted, "playwright")
            log.info("[refresh-price] playwright miss (no price) %s %s", req.platform, url)
        else:
            err = (result.error_message if result is not None else "no result") or ""
            log.info("[refresh-price] playwright crawl failed %s %s: %s", req.platform, url, err[:200])
    except Exception as exc:  # noqa: BLE001
        log.info("[refresh-price] playwright error %s %s: %s", req.platform, url, exc)

    # ── Tier 3: LLM extract (matches /scrape's safety net) ─────────────────
    llm = resolve_llm()
    if llm is None:
        log.info("[refresh-price] llm skipped (stub mode) %s %s", req.platform, url)
        return RefreshPriceResponse(price=None, isSold=False, fetched=False, tier=None)

    try:
        from crawl4ai.extraction_strategy import LLMExtractionStrategy

        provider, api_token = llm
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
        llm_result = await _arun_with_retry(
            url, req.platform, extraction_strategy=strategy, scope_to_target=True
        )
        if not llm_result.success or not llm_result.extracted_content:
            log.info("[refresh-price] llm miss (no content) %s %s", req.platform, url)
            return RefreshPriceResponse(price=None, isSold=False, fetched=False, tier=None)

        raw = llm_result.extracted_content
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(parsed, list):
            parsed = parsed[0] if parsed else {}
        if not isinstance(parsed, dict):
            log.info("[refresh-price] llm miss (bad shape) %s %s", req.platform, url)
            return RefreshPriceResponse(price=None, isSold=False, fetched=False, tier=None)

        resp = _refresh_result_from_extracted(parsed, "llm")
        if resp.fetched:
            log.info("[refresh-price] llm hit %s %s", req.platform, url)
        else:
            log.info("[refresh-price] llm miss (no price) %s %s", req.platform, url)
        return resp
    except Exception as exc:  # noqa: BLE001
        log.exception("[refresh-price] llm error %s %s: %s", req.platform, url, exc)
        return RefreshPriceResponse(price=None, isSold=False, fetched=False, tier=None)
