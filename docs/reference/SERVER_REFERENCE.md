# Crawli Server Reference

## DNS — Why two A records?

| Record | Name | What it covers |
|--------|------|----------------|
| `A` @ | `thecrawli.com` | The root domain — what users type |
| `A` www | `www.thecrawli.com` | The www subdomain — some users type this out of habit |

Both point to `5.78.187.97`. Without both, typing `www.thecrawli.com` would show a DNS error even if the root works. They're separate records because DNS treats them as separate names.

**Both Cloudflare AND the origin terminate TLS — it's not one or the other.** Cloudflare is actively proxying (confirmed live via `cf-ray`/`cf-cache-status`/`server: cloudflare` response headers on `curl -I https://thecrawli.com/`) and terminates the client-facing connection at the edge. Separately, nginx on the box also has its own Certbot/Let's Encrypt cert (`/etc/letsencrypt/live/thecrawli.com/`, covers both `thecrawli.com` and `www`) for the Cloudflare→origin hop — this is Cloudflare's "Full (strict)" SSL mode. An earlier version of this doc said Cloudflare handles HTTPS with no server cert at all, implying DNS-only (grey cloud) — that was wrong; treat Cloudflare as an active proxy layer in front of nginx, not just a DNS host.

**www must 301 to non-www** (canonicalization — avoids Bing/Google seeing duplicate content). The nginx `crawli` site has a dedicated `www.thecrawli.com` server block that `return 301 https://thecrawli.com$request_uri;` and the main block's `server_name` is `thecrawli.com` only. Verify: `curl -sI https://www.thecrawli.com/ | grep -i location` should show `https://thecrawli.com/`. If it returns 200 instead, the redirect block was lost — re-add it (see "www redirect" below).

---

## Deploying code changes

Every time you push new code to GitHub and want the server to run it:

```bash
ssh root@5.78.187.97
cd /opt/crawli && git pull && npm install && npm run build && systemctl restart crawli-next
# Then notify Bing/Yandex/Naver of any new/changed pages (IndexNow, best-effort):
curl -sf -X POST -H "Authorization: Bearer $(grep '^CRON_SECRET=' /opt/crawli/.env | cut -d= -f2)" https://thecrawli.com/api/indexnow/submit
```

**Order matters:** install dependencies first, then build, then restart. Restarting before the build completes loads the old code.

The final `curl` resubmits the full sitemap to IndexNow so Bing recrawls promptly instead of waiting. Safe to skip if a deploy changed no public pages — it's best-effort and never fails the deploy. Requires `INDEXNOW_KEY` in `/opt/crawli/.env` (must match `public/<key>.txt`). Compare pages are also auto-submitted by the daily refresh cron, so this curl mainly matters for new/edited blog posts.

`npm install` only needed when `package.json` changed. Safe to always run — fast if nothing changed.

**Requires `unzip` on the server** — Puppeteer's postinstall downloads a Chrome binary and needs `unzip` to extract it. If missing, `npm install` fails with "Extraction failed: Required native binary ... was not found in the system PATH" (confirmed already installed via `apt-get install -y unzip` on 2026-06-29 — flagging here in case of a fresh box).

**If `npm install` fails with "The browser folder ... exists but the executable ... is missing":** a prior failed extraction left a stale partial folder, and npm skips re-downloading because the folder already exists. Fix: `rm -rf /root/.cache/puppeteer && npm install`. Known upstream bug (extract-zip silently aborting mid-extraction) — see [puppeteer/puppeteer#15119](https://github.com/puppeteer/puppeteer/issues/15119).

If Python sidecar code changed (`crawl4ai-service/`):
```bash
systemctl restart crawli-sidecar
# If port 8000 still in use: fuser -k 8000/tcp && systemctl restart crawli-sidecar
```

### nginx: www → non-www redirect

Config: `/etc/nginx/sites-enabled/crawli`. The `www` hostname must 301 to the bare domain (SEO canonicalization). Target state — a dedicated redirect-only block, and the main server block serving `thecrawli.com` only:
```nginx
# Redirect-only block for www (reuses the same Certbot cert, which covers www)
server {
    listen 443 ssl;
    server_name www.thecrawli.com;
    ssl_certificate     /etc/letsencrypt/live/thecrawli.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/thecrawli.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    return 301 https://thecrawli.com$request_uri;
}
# Main block: server_name thecrawli.com;   (drop www from this line)
```
Apply safely:
```bash
cp /etc/nginx/sites-enabled/crawli /root/crawli.nginx.bak-$(date +%Y%m%d%H%M%S)  # backup
nano /etc/nginx/sites-enabled/crawli                                             # make the two edits
nginx -t && systemctl reload nginx                                              # validate THEN zero-downtime reload
curl -sI https://www.thecrawli.com/blog | grep -iE 'HTTP|location'              # expect 301 → https://thecrawli.com/blog
```

### IndexNow env var

`INDEXNOW_KEY` in `/opt/crawli/.env` must exactly equal the filename+contents of `public/<key>.txt` (currently `421d3af41bc04a0439069010586fcb56`). It authorizes IndexNow submissions from `lib/indexnow.ts` and `/api/indexnow/submit`. Rotate by generating a new key, renaming the `public/*.txt` file to match, and updating the env — all three must stay in sync.

### Bing priority reindex — run after any content change (added 2026-07-09)

IndexNow (above) only **notifies** Bing a URL changed — on a young/low-authority domain like thecrawli.com, Bing can sit on that notification for a long time before actually recrawling (this is what shows as "Discovered but not crawled" in Bing Webmaster Tools). To actively request a priority recrawl — the same effect as clicking "Request Indexing" in the Bing WMT UI — use the Bing Webmaster **Submission API** instead:

```bash
node scripts/submit-bing.mjs /blog/new-post-slug /compare/new-item-slug
```

Accepts any number of site-relative paths or full URLs. Requires `BING_WMT_API_KEY` in `.env` (Bing Webmaster Tools → Settings → API Access — must be generated by a human in the Bing WMT UI; Claude cannot create this key).

**When to run it:** any time you publish or meaningfully edit a blog post, add/edit a compare item, or change a static page's title/description — anything IndexNow's own callers (`/api/compare/refresh`, the deploy curl) wouldn't already cover, or when you want it prioritized rather than waiting on IndexNow's passive queue.

**Quota:** shared with manual "Request Indexing" clicks in the Bing WMT UI — observed ~100/day for thecrawli.com as of 2026-07-09, resets midnight GMT (`GetUrlSubmissionQuota` API returns the live number). **Only submit URLs that actually changed** — resubmitting unchanged URLs is crawl waste Bing's own guidelines penalize. Don't run this for every deploy; the existing IndexNow deploy curl already covers routine syncing.

### After publishing a new blog post

The content brief workflow deduplicates blog ideas against a Supabase `published_posts` table. Every time you publish a new post, add a row so future briefs don't suggest that topic again.

**Easiest — use the Supabase MCP in Claude Code** (just paste this and fill in the values):
```
mcp__supabase__execute_sql:
  INSERT INTO published_posts (title, slug)
  VALUES ('Your exact post title', 'the-slug-from-content/blog/');
```

**Or use the Supabase SQL editor** at https://supabase.com/dashboard/project/peyqxfijdrziqfjkxjsn/sql:
```sql
INSERT INTO published_posts (title, slug)
VALUES ('Your exact post title', 'the-slug-from-content/blog/');
```

The title should match the `title:` field in the post's frontmatter exactly. The slug is the filename without `.md`. The content brief fetches this table on every run — no other step needed.

### After posting a social batch (TikTok/IG carousels)

Mirror of the blog flow above, for social. The content brief now dedups social ideas in **two layers** (added 2026-06-19, "Phase 1: fix dedup memory"):
- `content_history` rows with `posted = true` → **hard dedup, forever** (the social equivalent of `published_posts`)
- `content_history` rows with `posted = false` → **soft dedup, last 21 days only** — unused ideas resurface instead of being burned forever

So when you actually turn brief ideas into a posted batch under `docs/marketing/YYYY-MM-DD/`, mark those ideas `posted = true` so they never get re-suggested. The brief email shows each idea's `#topic-key` (e.g. `#denim-history`) — that is the value to use.

**Easiest — Supabase MCP in Claude Code** (list the topic_keys of the posts you actually built):
```
mcp__supabase__execute_sql:
  UPDATE content_history SET posted = true
  WHERE kind = 'social' AND topic_key IN ('denim-history', 'vintage-sizing', 'understanding-leathers');
```

If a brief idea you posted isn't in `content_history` yet (e.g. you hand-wrote it), insert it as already-posted:
```sql
INSERT INTO content_history (kind, title, topic_key, posted)
VALUES ('social', 'Exact post label', 'topic-key-slug', true);
```

Why this matters: before this fix, the workflow logged **all 15 generated ideas every run** as "covered" whether or not you posted them, so the dedup memory was mostly never-posted ideas and the model kept regenerating + re-flagging the same subjects. Only marking what you actually post keeps the hard-block list honest. (Automating this from `tiktok-auto-post.json` is a future step — it isn't confirmed working on-device yet.)

---

## Going to production (Stripe live mode)

Do this when you're ready to take real payments. Everything up to this point is test mode — no real money moves.

### Step 1 — Get live Stripe keys
1. In Stripe dashboard, toggle to **Live mode** (top-left switch)
2. Go to **Developers → API keys**
3. Copy `pk_live_...` (publishable) and `sk_live_...` (secret)

### Step 2 — Create live webhook endpoint
1. Still in live mode: **Developers → Webhooks → Add destination**
2. URL: `https://thecrawli.com/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. Save → copy the `whsec_live_...` signing secret

### Step 3 — Update server .env
```bash
ssh root@5.78.187.97
nano /opt/crawli/.env
```

Change these three lines:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

### Step 4 — Rebuild
```bash
cd /opt/crawli && git pull && npm run build && systemctl restart crawli-next
```

---

## Testing payments (test mode)

Use card `4242 4242 4242 4242`, any future expiry, any CVC. No real money charged.

---

## Monitoring (Sentry + UptimeRobot)

### What each tool covers

| Failure type | UptimeRobot | Sentry |
|---|---|---|
| Site / Next.js completely down | ✅ | ❌ |
| Sidecar crashed (Python dead) | ✅ via `/api/health` | ❌ |
| One user hits a 500 error | ❌ | ✅ |
| Stripe webhook handler crashes | ❌ | ✅ |
| Search silently returns `[]` | ❌ | ❌ — needs smoke-test cron |
| Chromium pool poisoned (alive process, dead context) | ❌ | ❌ — needs smoke-test cron |

### UptimeRobot
- Dashboard: https://uptimerobot.com
- 2 monitors (both require token — see `.env` `INTERNAL_API_TOKEN`):

| Monitor | URL | Interval | Timeout |
|---|---|---|---|
| Crawli Health | `https://thecrawli.com/api/health?token=<INTERNAL_API_TOKEN>` | 5 min | 30s |
| Crawli Smoke | `https://thecrawli.com/api/smoke?token=<INTERNAL_API_TOKEN>` | 15 min | 60s |

**When health alert fires** (Next.js or sidecar down):
```bash
ssh root@5.78.187.97
systemctl status crawli-next crawli-sidecar
journalctl -u crawli-next -n 50
journalctl -u crawli-sidecar -n 50
# If sidecar port conflict: fuser -k 8000/tcp && systemctl restart crawli-sidecar
```

**When smoke alert fires** (sidecar alive but returning 0 results — pool poisoning):
```bash
systemctl restart crawli-sidecar
# crontab usually handles this automatically — check if it fired:
cat /var/log/crawli-smoke.log
```

### Sentry
- Captures exceptions thrown inside the app (server + browser)
- Project: https://crawli.sentry.io — org `crawli`, project `javascript-nextjs`
- Emails you when a new error type appears

**When you get an alert:**
1. Click the issue link in the email
2. Read **Stack Trace** — which file/line threw
3. Read **Breadcrumbs** — what the user did before the error
4. Reproduce locally → fix → deploy → click Resolve in Sentry

**Important gotcha — ad blockers:** Browser errors route through `thecrawli.com/monitoring` (not directly to Sentry) so ad blockers don't silently swallow them. Do not remove `tunnelRoute: "/monitoring"` from `next.config.ts`.

### The gap neither tool covers
The 2026-05-25 Chromium pool-poisoning bug — sidecar alive, health check passing, no exception thrown, but all searches returning `{}`. Only a smoke-test cron (run a real search, assert `listings.length > 0`) catches this class of failure.

### Smoke-test endpoint (`/api/smoke`)
Runs a real Grailed search for "nike air force 1" and returns 200 if ≥1 result comes back, 503 otherwise. Add a second UptimeRobot monitor pointing at `https://thecrawli.com/api/smoke` (15-min interval is fine — it's slow, ~10–30s per check).

**Setup:**
1. UptimeRobot → New Monitor
2. Type: HTTP(s)
3. URL: `https://thecrawli.com/api/smoke`
4. Interval: 15 minutes
5. Timeout: 60 seconds (the search takes up to 45s)
6. Same alert email as the health monitor

**Auto-healing cron (already configured on server):**
```bash
# View current crontab:
crontab -l
# The line should be:
*/15 * * * * curl -sf "https://thecrawli.com/api/smoke?token=<INTERNAL_API_TOKEN>" || (systemctl restart crawli-sidecar && echo "sidecar restarted at $(date)" >> /var/log/crawli-smoke.log)
```
This restarts the sidecar automatically when the smoke test fails — no human needed for the common pool-poisoning case. Check the log occasionally: `cat /var/log/crawli-smoke.log`

**Search-alerts cron (required — this is what makes alerts recur):**
```bash
# Crontab line on 5.78.187.97 (added 2026-06-30):
*/15 * * * * curl -sf -H "Authorization: Bearer <CRON_SECRET>" https://thecrawli.com/api/cron/run-alerts >> /var/log/crawli-alerts.log 2>&1
```
There is **no Vercel Cron** — the app is systemd-hosted, so without this line `/api/cron/run-alerts` is never called and every saved search's `next_run_at` freezes in the past (the 2026-06-30 silent-alerts bug). The endpoint processes all users' due alerts (≤20/tick), so one line covers everyone. `<CRON_SECRET>` is in `/opt/crawli/.env`. Check the log: `cat /var/log/crawli-alerts.log`.

**Compare-pages refresh cron (seeds the /compare/[slug] public pages):**
```bash
# Crontab line on 5.78.187.97 — add this after deploying Phase 2:
0 6 * * * curl -sf -X POST -H "Authorization: Bearer <CRON_SECRET>" https://thecrawli.com/api/compare/refresh >> /var/log/crawli-compare.log 2>&1
```
Runs once a day at 6 AM UTC. Scrapes 8 native platforms for each of the 15 enabled compare slugs, computes per-platform stats, upserts to `compare_snapshots`. Pages read from the DB (ISR revalidate=3600), so each hour after the cron they pull fresh data. Pages show "No listings" before the first cron run — manually trigger with: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://thecrawli.com/api/compare/refresh`. Check the log: `cat /var/log/crawli-compare.log`.

**If UptimeRobot still fires after the cron restart:** the sidecar can't recover on its own (Chromium crashed hard). SSH in and investigate:
```bash
systemctl status crawli-sidecar
journalctl -u crawli-sidecar -n 50
systemctl restart crawli-sidecar
curl https://thecrawli.com/api/smoke
```

### Weekly habit (5 min)
1. Sentry → Issues → sort by Events — anything spiking?
2. UptimeRobot → Dashboard — uptime % below 99.9%? Correlate downtime windows with deploy times.

---

## Server at a glance

| Thing | Value |
|-------|-------|
| Server IP | `5.78.187.97` |
| SSH | `ssh root@5.78.187.97` |
| App directory | `/opt/crawli/` |
| Env file | `/opt/crawli/.env` |
| Next.js port | `3000` (internal) |
| Sidecar port | `8000` (internal) |
| Public port | `80` via nginx → Cloudflare handles HTTPS |
| Logs (Next.js) | `journalctl -u crawli-next -f` |
| Logs (sidecar) | `journalctl -u crawli-sidecar -f` |

---

## n8n on the server (marketing automation)

**SSH works directly — Claude/future sessions can run `ssh root@5.78.187.97 '...'` from the Bash tool. No need to wait for the user or set up the `-L 5678` tunnel just to make changes** (the tunnel is only for opening the n8n editor UI in a browser).

| Thing | Value |
|-------|-------|
| n8n version | 2.8.4 (global npm install) |
| Service | `systemctl {status,restart} n8n` (unit `/etc/systemd/system/n8n.service`) |
| Editor | `https://n8n.thecrawli.com/` (Cloudflare-proxied) |
| Data dir | `/root/.n8n/` |
| Database | **SQLite** at `/root/.n8n/database.sqlite` (WAL mode) |
| Public REST API | **enabled** — key in `.env` as `n8n_api_key` / `n8n_api_key_v1` (same user, `n8n_api_key_v1` is the current one). Use `X-N8N-API-KEY` header against `https://n8n.thecrawli.com/api/v1/...` |
| n8n's node_modules | `/usr/lib/node_modules/n8n/node_modules` (bundles `sqlite3` + `flatted`) |
| MCP server | `https://n8n.thecrawli.com/mcp-server/http` (3 tools: `search_workflows`, `get_workflow_details`, `execute_workflow`). Configured in `.mcp.json` (gitignored). |

**No `sqlite3` CLI on the box.** Query the DB via the bundled driver:
```bash
ssh root@5.78.187.97 'NODE_PATH=/usr/lib/node_modules/n8n/node_modules node /tmp/q.js'
# in q.js: const db = new (require("sqlite3").Database)("/root/.n8n/database.sqlite", ...OPEN_READONLY)
```
Useful tables: `workflow_entity` (cols incl. `nodes`, `active`), `execution_entity` (`status`,`startedAt`), `execution_data` (`data` col = **flatted-encoded** JSON; parse with `require("flatted").parse(row.data)`, then `parsed.resultData.runData[nodeName][run].data.main[0]` = output items).

**Edit a workflow safely (CLI, since no API key):**
```bash
n8n export:workflow --id=<ID> --output=/tmp/wf.json   # preserves node ids + creds
# ...modify /tmp/wf.json with a node script...
n8n import:workflow --input=/tmp/wf.json              # upserts by id
n8n update:workflow --id=<ID> --active=true           # ⚠ import DEACTIVATES the workflow
systemctl restart n8n                                 # ⚠ activation/schedule only registers after restart
```
**Gotchas:** (1) `import:workflow` always **deactivates** — re-activate after. (2) `update:workflow` and activation changes **only take effect after `systemctl restart n8n`**. (3) On-demand run conflicts with the live service's task-runner broker (5679) unless overridden: `N8N_RUNNERS_BROKER_PORT=5690 N8N_RUNNERS_BROKER_LISTEN_ADDRESS=127.0.0.1 n8n execute --id <ID>` (this runs the FULL workflow, incl. sending the digest email).

Reddit monitor workflow id: `URiVWju6wMJcrQiW`. Repo source-of-truth: `docs/workflows/reddit-monitor.json`.

Pinterest auto-pin workflow id: `0SoGJUO8UrgPIJY7`. Repo source-of-truth: `docs/workflows/pinterest-crawli.json` — updated 2026-07-14 to call the new `/api/pinterest/generate-post-image` route (AI try-on composite) but **not yet imported to the live instance**, since that route only exists once the Next.js app is deployed; importing first would 404 the new node on every real save. To ship it once the app is deployed:
```bash
scp docs/workflows/pinterest-crawli.json root@5.78.187.97:/tmp/pinterest-wf-new.json
ssh root@5.78.187.97 '
  n8n import:workflow --input=/tmp/pinterest-wf-new.json
  n8n update:workflow --id=0SoGJUO8UrgPIJY7 --active=true
  systemctl restart n8n
'
```
The new node authenticates via `{{ $env.CRON_SECRET }}` — `CRON_SECRET` is already set on n8n's systemd unit (`/etc/systemd/system/n8n.service`, added 2026-07-14), so no further credential setup is needed.

### Google Search Console OAuth token expiration

The `weekly-seo-brief` and daily content workflows use the Google Search Console API to fetch per-page click/impression data. This uses a **separate OAuth 2.0 credential** from your user-facing Google login — it has its own refresh token that can expire independently.

**When it expires**, the workflow fails at the "Refresh Google token" node with `invalid_grant: Token has been expired or revoked`.

**To regenerate the token:**

1. **Get a new authorization code:**
   - Open https://developers.google.com/oauthplayground
   - Left panel → "Step 1: Select & authorize APIs"
   - Paste scope: `https://www.googleapis.com/auth/webmasters.readonly`
   - Click **Authorize APIs**
   - Sign in and grant permission to "Google APIs Explorer"
   - Complete the flow

2. **Extract the refresh token:**
   - Step 2 of OAuth Playground will display `access_token` and `refresh_token`
   - Copy the `refresh_token` value (the long one)

3. **Update n8n:**
   - Open https://n8n.thecrawli.com/
   - Go to **Credentials** (bottom-left menu)
   - Find "Google - Search Console" (or similar)
   - Paste the new refresh token
   - Save
   - Run: `systemctl restart n8n`

4. **Verify:**
   - Manually trigger `weekly-seo-brief` in n8n
   - It should pass "Refresh Google token" and complete the full workflow

**MCP "Available in MCP" toggle is buggy — known n8n bug, don't trust the UI checkbox (2026-06-17):**
- n8n's per-workflow "Available in MCP" setting (Settings → Available in MCP) silently reverts to `false` on refresh/save, even via the REST API (`PUT /workflows/:id` with `availableInMCP: true` returns 200 but a re-fetch immediately after shows it flipped back to `false`). This is a backend bug (n8n GitHub #25987 / community thread #267321: the backend's "deactivated" check misfires on workflows that are actually active+published). Fixed upstream in n8n v2.9.0+ (pre-release as of writing); this server runs 2.8.4.
- **Workaround that works:** write the flag directly into the SQLite `workflow_entity.settings` JSON column (bypasses the buggy app-layer save logic), then `systemctl restart n8n`. Confirmed this sticks across restarts and the MCP tools then return the workflow.
  ```bash
  ssh root@5.78.187.97 'cp /root/.n8n/database.sqlite /root/.n8n/database.sqlite.bak-$(date +%Y%m%d%H%M%S)'  # backup first
  # then a small node script using the bundled sqlite3 driver (see "No sqlite3 CLI" above) to:
  #   SELECT settings FROM workflow_entity WHERE id = ?
  #   JSON.parse, set availableInMCP = true, JSON.stringify
  #   UPDATE workflow_entity SET settings = ? WHERE id = ?
  ssh root@5.78.187.97 'systemctl restart n8n'
  ```
- Also required for a workflow to be MCP-eligible at all: published, and trigger type must be Webhook/Schedule/Form/Chat (Manual Trigger blocks publish with a "missing required parameters" error and isn't MCP-compatible anyway).
- If you re-touch these workflows in the n8n UI and click the toggle again, expect it to revert again until n8n ships the real fix — redo the DB-level workaround instead of trusting the checkbox.
- **Order matters:** any `PUT /api/v1/workflows/:id` call (even one unrelated to MCP, e.g. changing a schedule) resets `availableInMCP` back to `false` in the DB — even though the PUT's JSON response echoes back whatever you sent, including `availableInMCP: true`. That echo is misleading; only a DB reload (restart) reveals the real value. **Always do the DB-level `availableInMCP` write LAST**, after all other API/CLI edits to that workflow are finished, then restart once.
- **Renaming a node via the REST API does not rename it in `connections`** (n8n's older connection format keys by node *name*, not id) — if you rename a trigger node, you must also rewrite the matching key in the `connections` object in the same payload, or the trigger gets silently disconnected from the rest of the workflow.
