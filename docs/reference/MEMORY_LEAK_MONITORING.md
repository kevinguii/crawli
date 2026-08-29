# Memory Leak Monitoring & Detection

**Context:** On 2026-08-29, the sidecar hit OOM multiple times due to `SIDECAR_MAX_CONCURRENT_RENDERS=6` (default) allowing too many Chromium processes to run simultaneously. This doc outlines monitoring approaches to detect memory leaks and prevent future incidents.

## Current Setup (Option 1: In Use)

**What:** Daily snapshot script that logs memory usage, process stats, and recent warnings.

**Where:** 
- Script: `/opt/crawli/monitor-memory-trend.sh`
- Logs: `/var/log/crawli-health-trend.log`
- Cron: Runs daily at 09:00 UTC

**How to read the logs:**
```bash
ssh root@5.78.187.97 tail -50 /var/log/crawli-health-trend.log
```

**What to look for:**
- Memory trend: Is `Mem: used` creeping up day-over-day?
- Sidecar RSS: Should stay under 500MB; if crossing 1GB+ over days, that's a leak
- Warnings: `WARNING` and `Killed` entries indicate Chromium crashes or OOM events

**Baseline (2026-08-29):**
```
Mem: 5.0Gi / 7.6Gi free (the fix reduced it from 7.5Gi peak)
Sidecar process: ~355MB RSS
```

**Decision point:** If memory grows to 6+ Gi within 5 days, escalate to Option 2.

---

## Option 2: Sidecar Memory Profiling (Code Change)

**Effort:** 1-2 hours  
**Complexity:** Moderate  
**Accuracy:** High

**What:** Add a `/debug/memory` endpoint to the sidecar that reports:
- RSS (resident set size) — actual RAM used
- VMS (virtual memory) — total virtual address space
- Open file descriptors — connection count proxy
- Thread count — parallelism

**Why it helps:** Option 1 tells you *if* there's a leak (global memory trend). Option 2 tells you *where* (process-level detail) and helps correlate with render throughput.

**Implementation:**

1. Add to `crawl4ai-service/main.py`:
```python
import psutil
import os

@app.get("/debug/memory")
async def memory_status():
    proc = psutil.Process(os.getpid())
    mem = proc.memory_info()
    return {
        "rss_mb": mem.rss / 1024 / 1024,
        "vms_mb": mem.vms / 1024 / 1024,
        "num_fds": proc.num_fds(),
        "num_threads": proc.num_threads(),
        "timestamp": datetime.utcnow().isoformat(),
    }
```

2. Add an hourly cron that polls it:
```bash
curl -s http://localhost:8000/debug/memory >> /var/log/sidecar-memory-profile.log
```

3. Watch the trend:
```bash
tail -100 /var/log/sidecar-memory-profile.log | jq .rss_mb
```

**What indicates a leak:**
- RSS grows every hour even when `in_flight=0` (no renders running)
- VMS climbs without dropping (Chromium contexts not being freed)
- File descriptors grow unbounded (Supabase connections piling up)

---

## Option 3: Full Observability Dashboard (Best Practice)

**Effort:** 2-3 hours  
**Complexity:** High  
**Accuracy:** Very High  
**Maintenance:** Requires ongoing dashboard checks

**What:** Collect multiple metrics into a Supabase table and query for trends.

**Metrics to track:**
1. Memory: Python process RSS, total system RAM, Chromium instances
2. Connections: Supabase active connections, file descriptors
3. Sidecar health: Pool status (`in_flight`, `pool_alive`), render success rate
4. Platform errors: Failed renders per platform, timeout frequency

**Implementation outline:**

```python
# In crawl4ai-service/main.py or separate monitoring agent
@app.get("/metrics/collect")
async def collect_metrics():
    # Gather all stats
    metrics = {
        "timestamp": datetime.utcnow(),
        "sidecar_rss_mb": psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024,
        "system_memory_used_gb": psutil.virtual_memory().used / 1024**3,
        "chromium_instances": len([p for p in psutil.process_iter() if 'chromium' in p.name()]),
        "in_flight_renders": len(activeRenders),  # from your render tracking
        "pool_alive": pool.is_alive(),
        "supabase_active_connections": query supabase connection info,
    }
    
    # Store in Supabase
    supabase.table("monitoring_metrics").insert(metrics).execute()
    return {"status": "recorded"}
```

Then query for trends:
```sql
SELECT 
  date_trunc('hour', timestamp) as hour,
  avg(sidecar_rss_mb) as avg_rss,
  max(chromium_instances) as peak_chromium,
  avg(in_flight_renders) as avg_concurrency
FROM monitoring_metrics
WHERE timestamp > now() - interval '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

**When to use:** If you scale to higher traffic or notice trends in Option 1.

---

## Incident Response (If memory starts climbing again)

1. **Check Option 1 logs** — confirm memory trend
2. **Run Option 2 query** — identify if it's sidecar, Chromium, or system
3. **Lower concurrency** — reduce `SIDECAR_MAX_CONCURRENT_RENDERS` to 1 as emergency brake
4. **Restart sidecar** — `systemctl restart crawli-sidecar`
5. **Monitor for 24h** — if memory drops back, it was a leak; if stays high, it's traffic

---

## Related Incidents & Fixes

- **2026-08-29 06:15-08:17:** Three 503s in 2 hours due to OOM from `SIDECAR_MAX_CONCURRENT_RENDERS=6`. Fixed by reducing to 2. Memory dropped 7.5Gi → 4.4Gi immediately.
- **2026-08-28 06:31-06:36 & 13:39-13:44:** Two earlier 503s, first resolved by auto-restart, second likely transient network.

---

## Baseline Configuration (2026-08-29)

```
Server: 7.6Gi RAM, Hetzner VPS
SIDECAR_MAX_CONCURRENT_RENDERS=2 (was 6)
SIDECAR_BROWSER_POOL_SIZE=1 (default)
Expected baseline: 4-5Gi system memory used, ~300-400MB sidecar RSS
```

If baseline drifts significantly upward, escalate to Option 2.
