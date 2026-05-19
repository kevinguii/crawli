"""Token-usage logging for crawl4ai LLMExtractionStrategy.

Reads `strategy.total_usage` (a `TokenUsage` populated by crawl4ai after each
LLM extraction call) and appends one JSONL row per scrape to
`token_usage.jsonl`. No patching of litellm or the OpenAI client — we just
read the already-tracked numbers crawl4ai exposes.

Activated only when `TOKEN_TRACKING=1` is set. Default-off: zero impact on
production code paths.
"""

import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Optional

log = logging.getLogger("token_tracker")

TOKEN_LOG_FILE = os.path.join(
    os.path.dirname(__file__), "..", "token_usage.jsonl"
)


def is_enabled() -> bool:
    return os.environ.get("TOKEN_TRACKING") == "1"


def log_extraction(
    *,
    platform: str,
    url: str,
    strategy: Any,
    model: Optional[str] = None,
    extra: Optional[dict] = None,
) -> Optional[dict]:
    """Append one row for an LLMExtractionStrategy run.

    Reads `strategy.total_usage` (a TokenUsage with prompt_tokens /
    completion_tokens / total_tokens). Safe to call on a strategy that
    never made an LLM call — returns None if there's no usage to log.
    """
    if not is_enabled():
        return None

    usage = getattr(strategy, "total_usage", None)
    if usage is None:
        return None

    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", 0) or (prompt_tokens + completion_tokens))

    # If no tokens, no row — e.g. structured extractor handled it.
    if prompt_tokens == 0 and completion_tokens == 0:
        return None

    row = {
        "timestamp": datetime.now().isoformat(),
        "platform": platform,
        "url": url,
        "model": model or "unknown",
        "input_tokens": prompt_tokens,
        "output_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "extra": extra or {},
    }

    try:
        with open(TOKEN_LOG_FILE, "a") as f:
            f.write(json.dumps(row) + "\n")
    except Exception as e:
        log.warning(f"Failed to write token log: {e}")

    log.info(
        f"[tokens] {platform} | {row['model']} | in:{prompt_tokens} out:{completion_tokens} | {url[:60]}"
    )
    return row


def log_search_credits(
    *,
    platform: str,
    query: str,
    search_limit: int,
    bypass_firecrawl: bool = False,
) -> Optional[dict]:
    """Log Firecrawl-search credit spend for a platform.

    Firecrawl charges 2 credits per 10 results. With limit=20 (current prod),
    each platform-search = 4 credits. Search-page platforms (ThredUp,
    RealReal) bypass Firecrawl entirely.
    """
    if not is_enabled():
        return None

    credits = 0 if bypass_firecrawl else 2 * ((search_limit + 9) // 10)
    row = {
        "timestamp": datetime.now().isoformat(),
        "platform": platform,
        "query": query,
        "kind": "firecrawl_search",
        "search_limit": search_limit,
        "credits": credits,
    }
    try:
        with open(TOKEN_LOG_FILE, "a") as f:
            f.write(json.dumps(row) + "\n")
    except Exception as e:
        log.warning(f"Failed to write token log: {e}")
    return row
