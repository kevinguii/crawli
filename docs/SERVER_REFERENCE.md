# Crawli Server Reference

## DNS — Why two A records?

| Record | Name | What it covers |
|--------|------|----------------|
| `A` @ | `thecrawli.com` | The root domain — what users type |
| `A` www | `www.thecrawli.com` | The www subdomain — some users type this out of habit |

Both point to `5.78.187.97`. Without both, typing `www.thecrawli.com` would show a DNS error even if the root works. They're separate records because DNS treats them as separate names.

Both should have **Proxied** (orange cloud) enabled so Cloudflare handles HTTPS for you — no SSL cert setup needed on the server.

---

## Deploying code changes

Every time you push new code to GitHub and want the server to run it:

```bash
ssh root@5.78.187.97
cd /opt/crawli && git pull && npm install && npm run build && systemctl restart crawli-next
```

**Order matters:** build first, restart after. Restarting before the build completes loads the old code.

`npm install` only needed when `package.json` changed. Safe to always run — fast if nothing changed.

If Python sidecar code changed (`crawl4ai-service/`):
```bash
systemctl restart crawli-sidecar
# If port 8000 still in use: fuser -k 8000/tcp && systemctl restart crawli-sidecar
```

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
| Public REST API | **not enabled** — no `N8N_API_KEY` set; use the CLI instead |
| n8n's node_modules | `/usr/lib/node_modules/n8n/node_modules` (bundles `sqlite3` + `flatted`) |

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
