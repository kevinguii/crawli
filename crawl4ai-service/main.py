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

# Tier-1 (plain httpx) fast path used by /refresh-price. Doesn't share the
# render semaphore (httpx is cheap — no Chromium), but still capped so a
# 1000-item watchlist refresh can't open 1000 sockets at once.
SIDECAR_MAX_CONCURRENT_HTTP = max(1, int(os.environ.get("SIDECAR_MAX_CONCURRENT_HTTP", "12")))

# Semaphore + restart lock are initialised in lifespan() (asyncio primitives
# must bind to the running loop).
_render_semaphore: Optional[asyncio.Semaphore] = None
_http_semaphore: Optional[asyncio.Semaphore] = None
_restart_lock: Optional[asyncio.Lock] = None

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


# ── Crawler pool (B1) ────────────────────────────────────────────────────────
# B1: how many independent Chromium browsers to run in parallel. Default 1
# behaves identically to pre-B1. Flip to 2+ on a server with enough CPU/RAM
# to power multiple browsers (see SCALING.md for per-tier recommendations).
# All pool members share the global SIDECAR_MAX_CONCURRENT_RENDERS semaphore,
# so total Chromium load on the box is bounded regardless of pool size — the
# pool only splits *where* renders run, not *how many*. A driver crash in one
# member takes down only that member; the rest keep serving while restart runs.
SIDECAR_BROWSER_POOL_SIZE = max(1, int(os.environ.get("SIDECAR_BROWSER_POOL_SIZE", "1")))

_crawler_pool: list = []                       # AsyncWebCrawler instances (populated in lifespan)
_dead_pool_indices: set[int] = set()           # indices whose driver subprocess is dead
_pool_cycle = None                              # itertools.cycle iterator over indices
_pool_pick_lock: Optional[asyncio.Lock] = None  # serializes round-robin picks
_restart_tasks: dict[int, asyncio.Task] = {}    # per-index restart task tracking


def _pool_status() -> tuple[int, int]:
    """Return (alive_count, total_count) for the in-flight log + /health."""
    total = len(_crawler_pool) or SIDECAR_BROWSER_POOL_SIZE
    alive = total - len(_dead_pool_indices)
    return alive, total


# ── In-flight tracking (B3) ──────────────────────────────────────────────────
# Simple counter so every scrape can log how many renders are active. Useful
# in dev (visible in console) and a stepping-stone for any metrics endpoint
# we add later (SCALING.md §3 — observability progression).
_in_flight: int = 0
_in_flight_lock = threading.Lock()


def _truncate_url(url: str, max_len: int = 100) -> str:
    return url if len(url) <= max_len else url[:max_len] + "…"


# ── Per-domain pacing (B2) ───────────────────────────────────────────────────
# Min-interval between consecutive renders against the same host. Defends
# anti-bot triggers on platforms HANDOFF.md §7 F flags as 403-sensitive
# (Depop, Grailed) without slowing typical multi-platform searches.
# Tune by editing this dict; new entries auto-pick up next render.
DOMAIN_MIN_INTERVAL_MS: dict[str, int] = {
    "depop.com": 400,
    "grailed.com": 400,
    "ebay.com": 300,
    "vestiairecollective.com": 300,
}
_DEFAULT_DOMAIN_INTERVAL_MS = 150

_domain_locks: dict[str, asyncio.Lock] = {}
_domain_locks_guard = threading.Lock()
_domain_last_request: dict[str, float] = {}


def _domain_for_url(url: str) -> str:
    """Strip 'www.' from a URL's host. Subdomains otherwise stay distinct
    (us.vestiairecollective.com ≠ www.vestiairecollective.com) — matched
    against DOMAIN_MIN_INTERVAL_MS keys via suffix match in `_canonical_domain`.
    """
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:  # noqa: BLE001
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def _canonical_domain(host: str) -> str:
    """Map a host to its bucket key. Suffix-match against DOMAIN_MIN_INTERVAL_MS
    so 'us.vestiairecollective.com' paces with 'vestiairecollective.com'."""
    for key in DOMAIN_MIN_INTERVAL_MS:
        if host == key or host.endswith("." + key):
            return key
    return host


def _get_domain_lock(domain: str) -> asyncio.Lock:
    with _domain_locks_guard:
        lock = _domain_locks.get(domain)
        if lock is None:
            lock = asyncio.Lock()
            _domain_locks[domain] = lock
        return lock


async def _wait_for_domain_slot(url: str) -> None:
    """Sleep until enough time has elapsed since the last hit to this domain.

    Runs OUTSIDE the global render semaphore so we don't burn a Chromium slot
    while waiting. The per-domain lock serializes consecutive requests to the
    same host; different hosts are not blocked.
    """
    raw = _domain_for_url(url)
    if not raw:
        return
    domain = _canonical_domain(raw)
    interval_ms = DOMAIN_MIN_INTERVAL_MS.get(domain, _DEFAULT_DOMAIN_INTERVAL_MS)
    lock = _get_domain_lock(domain)
    async with lock:
        loop = asyncio.get_running_loop()
        now = loop.time()
        last = _domain_last_request.get(domain, 0.0)
        wait_s = (last + interval_ms / 1000.0) - now
        if wait_s > 0:
            await asyncio.sleep(wait_s)
        _domain_last_request[domain] = loop.time()


def _looks_like_driver_death(error_message: Optional[str]) -> bool:
    if not error_message:
        return False
    return any(pat in error_message for pat in _DRIVER_DEAD_PATTERNS)


async def _restart_crawler_once(idx: int) -> None:
    """A3+B1: rebuild a specific pool member after its driver subprocess died.

    Guarded by `_restart_lock` so concurrent observers all wait on the same
    recovery rather than each spawning their own. If `start()` fails the
    index stays in `_dead_pool_indices` so the next request retries — we
    never crash the FastAPI process trying to recover.
    """
    global crawler, _driver_dead
    assert _restart_lock is not None
    async with _restart_lock:
        if idx not in _dead_pool_indices or idx >= len(_crawler_pool):
            return
        log.warning("[crawler] pool[%d] driver dead — restarting Chromium", idx)
        try:
            old = _crawler_pool[idx]
            if old is not None:
                await old.close()
        except Exception:  # noqa: BLE001 — close may itself error on a dead pipe
            log.exception("[crawler] pool[%d] close errored during restart (continuing)", idx)
        try:
            from crawl4ai import AsyncWebCrawler, BrowserConfig
            browser_cfg = BrowserConfig(
                headless=True,
                verbose=False,
                enable_stealth=True,
                user_agent_mode="random",
            )
            new_c = AsyncWebCrawler(config=browser_cfg)
            await new_c.start()
            _crawler_pool[idx] = new_c
            _dead_pool_indices.discard(idx)
            # Back-compat: `crawler` global mirrors pool[0].
            if idx == 0:
                crawler = new_c
            _driver_dead = len(_dead_pool_indices) >= len(_crawler_pool)
            log.info("[crawler] pool[%d] restart complete", idx)
        except Exception:  # noqa: BLE001
            log.exception("[crawler] pool[%d] restart failed — will retry on next request", idx)


def _trigger_restart_in_background(idx: Optional[int] = None) -> None:
    """Fire-and-forget the recovery coroutine for a specific pool member.
    Idempotent — duplicate calls for the same index bounce off the existing
    task. When idx is None, queues a restart for every currently-dead member
    (used by the endpoint-level short-circuit which doesn't know specifics).
    """
    if idx is None:
        for dead_idx in list(_dead_pool_indices):
            _trigger_restart_in_background(dead_idx)
        return
    existing = _restart_tasks.get(idx)
    if existing is None or existing.done():
        try:
            _restart_tasks[idx] = asyncio.create_task(_restart_crawler_once(idx))
        except RuntimeError:
            # No running loop — next request will trigger it.
            pass


def _mark_driver_dead(idx: int, error_message: str) -> None:
    """Mark a pool member's driver as dead and kick off its restart."""
    global _driver_dead
    was_alive = idx not in _dead_pool_indices
    _dead_pool_indices.add(idx)
    if was_alive:
        log.error("[crawler] pool[%d] detected driver death: %s", idx, error_message[:200])
    _driver_dead = len(_dead_pool_indices) >= len(_crawler_pool) and len(_crawler_pool) > 0
    _trigger_restart_in_background(idx)


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
    global crawler, _render_semaphore, _http_semaphore, _restart_lock, _pool_cycle, _pool_pick_lock
    import itertools
    from crawl4ai import AsyncWebCrawler, BrowserConfig

    # Bind asyncio primitives to the running event loop.
    _render_semaphore = asyncio.Semaphore(SIDECAR_MAX_CONCURRENT_RENDERS)
    _http_semaphore = asyncio.Semaphore(SIDECAR_MAX_CONCURRENT_HTTP)
    _restart_lock = asyncio.Lock()
    _pool_pick_lock = asyncio.Lock()
    _pool_cycle = itertools.cycle(range(SIDECAR_BROWSER_POOL_SIZE))

    browser_cfg = BrowserConfig(
        headless=True,
        verbose=False,
        enable_stealth=True,
        user_agent_mode="random",
    )
    # NOTE: light_mode, text_mode, memory_saving_mode all break extraction on
    # React/Vue SPA sites (Grailed, Depop, StockX) by disrupting JS rendering
    # or producing empty chunk sections for the LLM strategy. Keep plain.
    #
    # B1: build the pool. Each member is its own AsyncWebCrawler with its own
    # Chromium subprocess; they share `_render_semaphore` so total concurrent
    # renders are still capped. pool_size=1 (default) keeps behavior identical
    # to pre-B1.
    for i in range(SIDECAR_BROWSER_POOL_SIZE):
        c = AsyncWebCrawler(config=browser_cfg)
        await c.start()
        _crawler_pool.append(c)
        log.info("[pool] crawler[%d] started", i)
    # Back-compat: `crawler` mirrors pool[0] for any code path still referencing it.
    crawler = _crawler_pool[0]
    log.info(
        "crawl4ai sidecar ready (pool_size=%d, max_concurrent_renders=%d)",
        SIDECAR_BROWSER_POOL_SIZE, SIDECAR_MAX_CONCURRENT_RENDERS,
    )
    try:
        yield
    finally:
        for i, c in enumerate(_crawler_pool):
            try:
                await c.close()
                log.info("crawl4ai crawler stopped (pool[%d])", i)
            except Exception:  # noqa: BLE001
                log.exception("error closing pool[%d]", i)
        _crawler_pool.clear()
        for plat, c in list(_platform_crawlers.items()):
            try:
                await c.close()
                log.info("crawl4ai crawler stopped (platform=%s)", plat)
            except Exception:  # noqa: BLE001
                log.exception("error closing platform crawler %s", plat)
        _platform_crawlers.clear()
        _platform_warmed.clear()
        log.info("crawl4ai sidecar shutdown complete")


async def _pick_crawler() -> tuple[int, Optional[object]]:
    """B1: round-robin pick from the pool, skipping dead members.

    Returns (idx, crawler) or (-1, None) if every member is dead. Endpoint
    short-circuits at `_driver_dead_response` should prevent that second case
    in normal flow; a None here means the pool died between the endpoint
    check and the pick (race) — caller should raise/return failure.
    """
    if not _crawler_pool:
        return -1, None
    assert _pool_pick_lock is not None and _pool_cycle is not None
    async with _pool_pick_lock:
        for _ in range(len(_crawler_pool)):
            idx = next(_pool_cycle)
            if 0 <= idx < len(_crawler_pool) and idx not in _dead_pool_indices:
                return idx, _crawler_pool[idx]
    return -1, None


@asynccontextmanager
async def _scheduled_render(platform: str, url: str):
    """Single gate for every crawler.arun() call: pace → semaphore → log.

    Order matters:
      1. B2 — per-domain pacing OUTSIDE the semaphore (don't burn a slot
         while waiting on the domain lock).
      2. A1 — global render semaphore (caps total Chromium concurrency).
      3. B3 — emit the in-flight log line so load level is visible in the
         log stream. Also bumps the counter that /health surfaces.
    """
    global _in_flight
    await _wait_for_domain_slot(url)
    assert _render_semaphore is not None
    async with _render_semaphore:
        with _in_flight_lock:
            _in_flight += 1
            current = _in_flight
        alive, total = _pool_status()
        log.info(
            "[scrape] platform=%s url=%s in_flight=%d pool=%d/%d cache=miss",
            platform, _truncate_url(url), current, alive, total,
        )
        try:
            yield
        finally:
            with _in_flight_lock:
                _in_flight = max(0, _in_flight - 1)


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
        # realreal's crawler is NOT in the pool — pacing + semaphore still
        # apply, but a driver death here can't mark a pool index (-1 means
        # platform-specific, log-only handling).
        async with _scheduled_render("realreal", THEREALREAL_WARMUP_URL):
            warmup_result = await c.arun(url=THEREALREAL_WARMUP_URL, config=cfg)
        if warmup_result is not None and _looks_like_driver_death(getattr(warmup_result, "error_message", None)):
            log.error(
                "[realreal] warmup hit driver death (not pool-tracked): %s",
                (warmup_result.error_message or "")[:200],
            )
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
    size: Optional[str] = None


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
    size = raw.get("size") if isinstance(raw.get("size"), str) else None
    return ScrapedListing(
        url=url,
        title=title,
        price=price,
        currency=currency,
        isSold=is_sold,
        condition=condition,
        imageUrl=image_url,
        size=size,
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

    crawler_override: optional per-platform crawler (e.g. realreal's
    managed-profile instance). When None, picks the next alive pool member
    via round-robin (B1). Each render goes through `_scheduled_render` which
    adds per-domain pacing (B2), the global semaphore (A1), and the
    in-flight log line (B3).

    A2: result.error_message is scanned for driver-death markers so a dead
    pool member flips its `_dead_pool_indices` entry and triggers background
    recovery instead of being retried into the corpse.
    """
    if crawler_override is not None:
        c = crawler_override
        idx = -1  # platform-specific crawlers aren't tracked in the pool
    else:
        idx, c = await _pick_crawler()
        if c is None:
            # Race: pool died between endpoint-level check and now.
            raise RuntimeError("crawler pool unavailable — all members dead")

    cfg = _build_run_cfg(platform, extraction_strategy=extraction_strategy, attempt=1, scope_to_target=scope_to_target)
    async with _scheduled_render(platform, url):
        result = await c.arun(url=url, config=cfg)
    err = (result.error_message or "") if result is not None else ""
    if _looks_like_driver_death(err):
        if idx >= 0:
            _mark_driver_dead(idx, err)
        else:
            log.error("[crawler] platform-specific crawler driver death (not pool-tracked): %s", err[:200])
        return result
    if (not result.success or _POSHMARK_NAV_ERROR in err) and platform == "poshmark":
        log.info("[retry] poshmark crawl hit navigation error, retrying with networkidle wait")
        cfg = _build_run_cfg(platform, extraction_strategy=extraction_strategy, attempt=2, scope_to_target=scope_to_target)
        # Pick a fresh pool member on retry (could be a different one) if not overridden.
        if crawler_override is None:
            idx2, c2 = await _pick_crawler()
            if c2 is None:
                return result
            idx, c = idx2, c2
        async with _scheduled_render(platform, url):
            result = await c.arun(url=url, config=cfg)
        err = (result.error_message or "") if result is not None else ""
        if _looks_like_driver_death(err):
            if idx >= 0:
                _mark_driver_dead(idx, err)
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
    alive, total = _pool_status()
    return {
        "status": "ok",
        "llm_mode": "active" if llm else "stub",
        "provider": llm[0] if llm else None,
        # A4: distinguish "FastAPI up" from "Chromium up". When ALL pool
        # members are dead this flips to False until at least one finishes
        # restart (~2-5s). Partial pool death keeps this True — pool_alive
        # tells the real story.
        "crawler_alive": not _driver_dead,
        "max_concurrent_renders": SIDECAR_MAX_CONCURRENT_RENDERS,
        "max_concurrent_http": SIDECAR_MAX_CONCURRENT_HTTP,
        # B1: pool visibility. pool_size == pool_alive in normal operation;
        # pool_alive drops below pool_size while a member is restarting.
        "pool_size": total,
        "pool_alive": alive,
        # B3: current in-flight render count. Useful for ad-hoc load checks
        # via `curl /health` while a search is in progress.
        "in_flight": _in_flight,
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
        log.info("[scrape] platform=%s url=%s cache=hit", req.platform, _truncate_url(req.url))
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
        log.info("[scrape-search] platform=%s query=%s cache=hit results=%d", req.platform, req.query, len(cached))
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
    # Wrapped in B2 per-domain pacing + a small global httpx semaphore so a
    # large watchlist refresh respects the same anti-bot intervals as renders
    # and can't open hundreds of sockets at once. See HANDOFF §624/§1666.
    try:
        import httpx
        await _wait_for_domain_slot(url)
        assert _http_semaphore is not None
        async with _http_semaphore:
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
