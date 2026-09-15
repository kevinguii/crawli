# Cleanup Before Finishing

> **Run this before declaring a session done.** Ensures ports 3000 and 8000 are free so the user can start fresh testing without "address already in use" errors.
>
> **2026-09-15:** repo archived. `node_modules` and both Python venvs were stripped, so nothing is listening on 3000/8000 unless you have run `RESTORE.md` first.

## Kill running services

```bash
# Kill Next.js (port 3000)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Kill Python sidecar (port 8000)
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Verify both are dead
sleep 1
lsof -ti:3000 && echo "Port 3000 still in use" || echo "Port 3000 is free"
lsof -ti:8000 && echo "Port 8000 still in use" || echo "Port 8000 is free"
```

One-liner for both:
```bash
lsof -ti:3000,8000 | xargs kill -9 2>/dev/null || true; sleep 1; lsof -ti:3000,8000 && echo "Cleanup incomplete" || echo "All ports freed"
```

## Why this matters

- Dev servers started during testing (`npm run dev:all`) run in the background
- If not killed, `npm run dev:all` in the next test will fail with "EADDRINUSE: address already in use"
- User expects to start fresh; stale processes block that
- `kill -9` is safe here — it's development, not production

## Add to your session end checklist

```
- [ ] All tests passed
- [ ] Docs updated (HANDOFF, PLATFORM_STATUS, PITFALLS, or SYSTEM_DESIGN)
- [ ] Port 3000 and 8000 freed (run cleanup script above)
```
