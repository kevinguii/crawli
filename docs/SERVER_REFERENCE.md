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
# 1. SSH into the server
ssh root@5.78.187.97

# 2. Pull, build, restart (one line)
cd /opt/crawli && git pull && npm run build && systemctl restart crawli-next
```

The build takes ~30 seconds. The site is briefly unavailable during `systemctl restart` (a couple seconds). That's it.

If you also changed Python sidecar code (`crawl4ai-service/`):
```bash
systemctl restart crawli-sidecar
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
cd /opt/crawli && npm run build && systemctl restart crawli-next
```

---

## Testing payments (test mode)

Use card `4242 4242 4242 4242`, any future expiry, any CVC. No real money charged.

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
