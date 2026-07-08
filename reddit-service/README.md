# Crawli Reddit Service (PRAW)

Tiny FastAPI sidecar that searches Reddit through **PRAW** (the Python client for
Reddit's official Data API). It replaces the Zernio `GET /v1/reddit/search` call
in the "reddit monitor crawli" n8n workflow.

The response shape is a **drop-in match** for what Zernio returned — a top-level
`items` array with the same camelCase keys (`id, title, subreddit, author,
permalink, url, score, numComments, createdUtc, selftext, over18, stickied`) —
so no downstream n8n node changes. Workflow variant: `docs/workflows/reddit-monitor-praw.json`.

## Why this exists

- **Rate limits:** official API allows 100 queries/min per OAuth client id, vs
  Zernio's burst-429 ceiling. The daily 5-subreddit pull is a rounding error
  against that budget.
- **Coverage:** Zernio's search passthrough has no full-feed endpoint. This
  service also exposes `/reddit/new` (up to 1000 newest posts per subreddit),
  which is the path to scrape *far* more than the old keyword-search window.

> **ToS note:** Reddit's free tier is officially non-commercial. This is a
> low-volume, human-in-the-loop marketing monitor; you (not Zernio) now hold the
> OAuth app, so you own that exposure. See `docs/planning/AGENT_PLAN.md` §1B.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness; does not call Reddit |
| GET | `/reddit/search?subreddit=&q=&sort=new&time_filter=week&limit=50` | Keyword search in one subreddit (parity with old Zernio call) |
| GET | `/reddit/new?subreddit=&limit=100` | Full feed, newest first (coverage win) |

If `REDDIT_SERVICE_TOKEN` is set, append `&token=...` to every call.

## Register the Reddit app (one-time, you must do this)

1. Log in to Reddit as **u/Majestic_Crawli6792** (the account already connected
   in Zernio) and go to <https://www.reddit.com/prefs/apps>.
2. Click **"create another app…"** at the bottom.
3. Fill in:
   - **name:** `crawli-reddit-monitor`
   - **type:** select **script**
   - **description:** optional
   - **about url:** `https://thecrawli.com`
   - **redirect uri:** `http://localhost:8100` (required field; unused for read-only)
4. Click **create app**.
5. Copy the two values:
   - **client id** — the string just under "personal use script" (top-left of the app box)
   - **secret** — the `secret` field
6. (2025 change to verify) Reddit may require app pre-approval / a registered use
   case. If the app is throttled or rejected, complete Reddit's developer
   application at <https://support.reddithelp.com/hc/en-us/articles/16160319875092>.

Put the values in `reddit-service/.env` (copy from `.env.example`):

```
REDDIT_CLIENT_ID=<client id>
REDDIT_CLIENT_SECRET=<secret>
REDDIT_USER_AGENT=crawli-reddit-monitor/1.0 by u/Majestic_Crawli6792
```

## Run locally

```bash
cd reddit-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in the two creds
uvicorn main:app --host 127.0.0.1 --port 8100
```

Smoke test:

```bash
curl 'http://127.0.0.1:8100/health'
curl 'http://127.0.0.1:8100/reddit/search?subreddit=frugalfemalefashion&q=thrift%20OR%20poshmark&sort=new&limit=10'
```

## Deploy on the Hetzner box (5.78.187.97)

n8n runs on the same host, so it reaches this service over `127.0.0.1:8100` — no
public exposure, no nginx route needed.

```bash
ssh root@5.78.187.97
cd /opt/crawli && git pull
cd reddit-service
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && nano .env   # paste the two Reddit creds
```

Create the systemd unit `/etc/systemd/system/crawli-reddit.service`:

```ini
[Unit]
Description=Crawli Reddit PRAW sidecar
After=network.target

[Service]
WorkingDirectory=/opt/crawli/reddit-service
ExecStart=/opt/crawli/reddit-service/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8100
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now crawli-reddit
systemctl status crawli-reddit
curl http://127.0.0.1:8100/health
```

Logs: `journalctl -u crawli-reddit -f`

## Switch the workflow over

1. In n8n, import `docs/workflows/reddit-monitor-praw.json` (or edit the existing
   workflow's search node to GET `http://127.0.0.1:8100/reddit/search`, removing
   the Zernio header-auth credential).
2. Run on demand and confirm the digest email arrives, same as before.
3. Keep the original Zernio workflow disabled-but-present until the PRAW run is
   verified, then archive it.
