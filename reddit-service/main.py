"""FastAPI sidecar that searches Reddit via PRAW (the official Reddit Data API).

Drop-in replacement for the Zernio `GET /v1/reddit/search` call used by the
"reddit monitor crawli" n8n workflow. The response shape mirrors Zernio's
exactly — a top-level `items` array whose objects use the same camelCase keys
the workflow's "Collect posts" node already reads — so no downstream n8n node
needs to change.

Why PRAW instead of Zernio:
  - Official Reddit API: 100 queries/min per OAuth client id (vs Zernio's
    burst-429 ceiling). The daily 5-subreddit pull uses a fraction of that.
  - Full-listing access (subreddit.new/.hot/.top), which Zernio's search
    passthrough cannot give. This file exposes /reddit/search (keyword parity
    with the current workflow) and /reddit/new (full-feed, up to 1000 posts)
    so coverage can grow past the old keyword-search ceiling later.

Auth: read-only application-only OAuth — needs only REDDIT_CLIENT_ID +
REDDIT_CLIENT_SECRET + REDDIT_USER_AGENT (no Reddit username/password). PRAW
runs read_only automatically when no user creds are supplied; search + listing
reads are all that requires.

Run: uvicorn main:app --host 127.0.0.1 --port 8100
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import praw
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

# Load .env from this service dir first, then fall back to project root so the
# service can share the root .env on the server if preferred.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("reddit-sidecar")

# Optional shared-secret gate. If REDDIT_SERVICE_TOKEN is set, callers must pass
# ?token=... (n8n adds it as a query param). Unset = open (fine when bound to
# 127.0.0.1 only, which is the default deployment).
SERVICE_TOKEN = os.getenv("REDDIT_SERVICE_TOKEN", "").strip()

_reddit: Optional[praw.Reddit] = None


def get_reddit() -> praw.Reddit:
    """Lazily build a read-only PRAW client. Raised errors surface as 503."""
    global _reddit
    if _reddit is None:
        client_id = os.getenv("REDDIT_CLIENT_ID", "").strip()
        client_secret = os.getenv("REDDIT_CLIENT_SECRET", "").strip()
        user_agent = os.getenv("REDDIT_USER_AGENT", "crawli-reddit-monitor/1.0").strip()
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=503,
                detail="REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not configured",
            )
        _reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent,
        )
        _reddit.read_only = True
        log.info("PRAW client initialized (read_only=%s)", _reddit.read_only)
    return _reddit


def _serialize(s: "praw.models.Submission") -> dict:
    """Map a PRAW Submission to the exact camelCase shape Zernio returned, so the
    n8n "Collect posts" node keeps working unchanged."""
    permalink = getattr(s, "permalink", "") or ""
    if permalink.startswith("/"):
        permalink = "https://www.reddit.com" + permalink
    author = getattr(s, "author", None)
    return {
        "id": s.id,
        "title": s.title or "",
        "subreddit": str(s.subreddit) if s.subreddit else "",
        "author": author.name if author else "[deleted]",
        "permalink": permalink,
        "url": getattr(s, "url", "") or "",
        "score": int(getattr(s, "score", 0) or 0),
        "numComments": int(getattr(s, "num_comments", 0) or 0),
        "createdUtc": int(getattr(s, "created_utc", 0) or 0),
        "selftext": getattr(s, "selftext", "") or "",
        "over18": bool(getattr(s, "over_18", False)),
        "stickied": bool(getattr(s, "stickied", False)),
    }


def _check_token(token: Optional[str]) -> None:
    if SERVICE_TOKEN and token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="invalid or missing token")


app = FastAPI(title="crawli-reddit-service")


@app.get("/health")
def health():
    """Cheap liveness check — does not touch Reddit."""
    return {"ok": True, "configured": bool(os.getenv("REDDIT_CLIENT_ID"))}


@app.get("/reddit/search")
def reddit_search(
    subreddit: str = Query(..., description="Subreddit name, no r/ prefix"),
    q: str = Query(..., description="Reddit search query (supports OR / quoted phrases)"),
    sort: str = Query("new", description="relevance|hot|top|new|comments"),
    time_filter: str = Query("all", description="all|day|hour|month|week|year"),
    limit: int = Query(50, ge=1, le=250, description="Reddit caps search listings ~250"),
    token: Optional[str] = Query(None),
    # Accepted for drop-in parity with the old Zernio call; unused (PRAW's
    # subreddit.search already restricts to the subreddit).
    restrict_sr: Optional[str] = Query(None),
    accountId: Optional[str] = Query(None),
):
    """Keyword search within one subreddit — parity with the old Zernio call."""
    _check_token(token)
    try:
        sr = get_reddit().subreddit(subreddit)
        items = [
            _serialize(s)
            for s in sr.search(q, sort=sort, time_filter=time_filter, limit=limit)
        ]
        return {"items": items}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — surface any PRAW/Reddit error as 502
        log.exception("reddit search failed: %s", e)
        raise HTTPException(status_code=502, detail=f"reddit search failed: {e}")


@app.get("/reddit/new")
def reddit_new(
    subreddit: str = Query(..., description="Subreddit name, no r/ prefix"),
    limit: int = Query(100, ge=1, le=1000, description="Reddit caps listings at 1000"),
    token: Optional[str] = Query(None),
):
    """Full-feed pull — newest posts regardless of keyword. This is the coverage
    win over Zernio: up to 1000 recent posts per subreddit, filter downstream."""
    _check_token(token)
    try:
        sr = get_reddit().subreddit(subreddit)
        items = [_serialize(s) for s in sr.new(limit=limit)]
        return {"items": items}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        log.exception("reddit new failed: %s", e)
        raise HTTPException(status_code=502, detail=f"reddit new failed: {e}")
