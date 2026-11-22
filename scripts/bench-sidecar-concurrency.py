#!/usr/bin/env python3
"""
Sidecar render-concurrency bakeoff.

Sweeps SIDECAR_MAX_CONCURRENT_RENDERS across a set of candidate values on the
PRODUCTION box (5.78.187.97) and measures, for a fixed representative render
workload:
  - peak system memory used (Gi)
  - wall-clock duration to drain the workload
  - error / timeout count

Why this exists: the Aug 28-29 OOM incidents happened at RENDERS=6 (the code
default), and the current safe value (3) was picked by trial and error after
the incident, not by measurement. This script makes the actual ceiling
visible instead of guessed at, so future tuning (e.g. after a RAM upgrade,
or after the compare-refresh workload shrinks) can be a measurement, not a
guess repeated from scratch.

SAFETY:
  - Requires --confirm to actually run (dry-run by default, just prints the plan).
  - Every trial is memory-watched WHILE it runs (2s polling, one combined SSH
    call per tick). If available memory drops below --mem-floor-gb, the trial
    is aborted immediately and the sidecar is restored to the safe baseline.
  - Every SSH call retries with backoff on transport-level failure (timeout,
    connection drop) — three earlier runs of this script each hit a different
    single-shot SSH call failing with no retry, twice leaving production
    briefly on the wrong setting until manually checked. This version treats
    "the control channel itself is unreliable" as the normal case to design
    for, not an edge case.
  - Restoring the safe baseline (--baseline, default 3) at the end, on error,
    or on Ctrl-C is the single most important operation in this script: it
    retries persistently (up to RESTORE_MAX_ATTEMPTS, ~5 min of retrying) and
    verifies via /health before giving up. If it still can't confirm the
    restore, it prints a loud, impossible-to-miss warning instead of a quiet
    traceback, because a silent failure here is the actual danger case.

Usage:
  python3 scripts/bench-sidecar-concurrency.py                    # dry run, prints plan only
  python3 scripts/bench-sidecar-concurrency.py --confirm          # actually runs
  python3 scripts/bench-sidecar-concurrency.py --confirm --values 2,3,4,5
"""
import argparse
import json
import subprocess
import time
from dataclasses import dataclass, field

HOST = "root@5.78.187.97"
OVERRIDE_PATH = "/etc/systemd/system/crawli-sidecar.service.d/override.conf"
RESTORE_MAX_ATTEMPTS = 15
RESTORE_RETRY_DELAY_S = 20

# Representative workload: a handful of platform/query pairs spanning both
# fast structured-extractor platforms and slow CSR platforms (StockX,
# Vestiaire) so the test reflects real tail-latency behavior, not just the
# easy cases. Deliberately smaller than the full compare-refresh batch (15
# items x 9 platforms post-reduction) — this is meant to find the ceiling
# safely, not to reproduce the incident at full scale.
WORKLOAD = [
    ("grailed", "nike air force 1"),
    ("depop", "adidas samba"),
    ("mercari", "hermes birkin bag"),
    ("thredup", "carhartt wip jacket"),
    ("vestiaire", "gucci marmont bag"),
    ("vinted", "chanel classic flap bag"),
    ("poshmark", "stussy hoodie"),
    ("stockx", "jordan 1 retro high"),
    ("ebay", "rolex datejust"),
]

TRANSPORT_ERROR_HINTS = (
    "connection", "timed out", "timeout", "closed by remote host",
    "broken pipe", "could not resolve", "no route to host",
)


class SshTransportError(RuntimeError):
    pass


def ssh(cmd: str, timeout: int = 35, retries: int = 3, retry_delay: float = 3.0) -> str:
    """Run a command over SSH, retrying on transport-level failure (timeout,
    dropped connection). Does NOT retry a remote command's own legitimate
    non-zero exit (e.g. `curl -sf` failing) — only cases that look like the
    SSH transport itself, not the remote command, is what failed."""
    last_err = ""
    for attempt in range(1, retries + 1):
        try:
            result = subprocess.run(
                ["ssh", "-o", "ConnectTimeout=10", HOST, cmd],
                capture_output=True, text=True, timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            last_err = f"ssh call itself timed out after {timeout}s"
        else:
            stderr_lower = (result.stderr or "").lower()
            looks_like_transport_failure = (
                result.returncode != 0
                and not result.stdout.strip()
                and any(hint in stderr_lower for hint in TRANSPORT_ERROR_HINTS)
            )
            if not looks_like_transport_failure:
                return result.stdout.strip()
            last_err = f"transport-level ssh failure: {result.stderr.strip()[:200]}"

        if attempt < retries:
            print(f"    [ssh retry {attempt}/{retries}] {last_err}")
            time.sleep(retry_delay * attempt)
    raise SshTransportError(f"ssh command failed after {retries} attempts: {last_err}\ncmd={cmd!r}")


def get_health() -> dict | None:
    out = ssh("curl -sf -m 5 http://localhost:8000/health || true")
    try:
        return json.loads(out)
    except (json.JSONDecodeError, ValueError):
        return None


def set_renders(value: int) -> bool:
    """Best-effort single attempt to set + verify RENDERS=value. Returns True
    if confirmed via /health, False otherwise. Does not raise on transport
    hiccups — callers decide how hard to retry (see restore_baseline_or_die
    for the one call site where this must not be allowed to just give up)."""
    try:
        ssh(f'printf \'[Service]\\nEnvironment="SIDECAR_MAX_CONCURRENT_RENDERS={value}"\\n\' > {OVERRIDE_PATH}')
        ssh("systemctl daemon-reload && systemctl restart crawli-sidecar", timeout=60)
    except SshTransportError as e:
        print(f"    [set_renders] transport failure applying RENDERS={value}: {e}")
        return False

    for _ in range(30):
        data = get_health()
        if data and data.get("pool_alive") and data.get("max_concurrent_renders") == value:
            return True
        time.sleep(2)
    return False


def restore_baseline_or_die(baseline: int) -> None:
    """The one call that must not quietly fail. Retries persistently and
    verifies via /health; if it still can't confirm after RESTORE_MAX_ATTEMPTS,
    it fails LOUDLY rather than letting a traceback bury the fact that
    production may be on an untested/unsafe RENDERS value."""
    print(f"\nRestoring safe baseline RENDERS={baseline}...")
    for attempt in range(1, RESTORE_MAX_ATTEMPTS + 1):
        try:
            if set_renders(baseline):
                print(f"Confirmed: sidecar is running RENDERS={baseline}.")
                return
        except Exception as e:  # noqa: BLE001 - this path must never itself crash
            print(f"  [restore attempt {attempt}/{RESTORE_MAX_ATTEMPTS}] unexpected error: {e}")
        print(f"  [restore attempt {attempt}/{RESTORE_MAX_ATTEMPTS}] not confirmed yet, retrying in {RESTORE_RETRY_DELAY_S}s...")
        time.sleep(RESTORE_RETRY_DELAY_S)

    print("\n" + "!" * 70)
    print("! COULD NOT CONFIRM SIDECAR RESTORE TO SAFE BASELINE.")
    print(f"! Manually SSH in and check: ssh {HOST} 'curl -sf http://localhost:8000/health'")
    print(f"! Expected max_concurrent_renders={baseline}. Fix by hand if it's wrong.")
    print("!" * 70 + "\n")


def read_mem_gb() -> tuple[float, float]:
    """(used_gb, available_gb) from a single `free -m` call."""
    out = ssh("free -m | awk '/Mem:/ {print $3\",\"$7}'")
    used_mb, avail_mb = out.split(",")
    return int(used_mb) / 1024, int(avail_mb) / 1024


@dataclass
class TrialResult:
    renders: int
    duration_s: float = 0.0
    peak_used_gb: float = 0.0
    mem_samples: list = field(default_factory=list)
    errors: int = 0
    aborted: bool = False
    timed_out: bool = False
    abort_reason: str = ""


def run_trial(renders: int, mem_floor_gb: float) -> TrialResult:
    result = TrialResult(renders=renders)
    if not set_renders(renders):
        result.aborted = True
        result.abort_reason = f"could not confirm sidecar applied RENDERS={renders}"
        return result

    # Launch the workload as background curls on the box itself (sidecar
    # port isn't exposed past the firewall — see docs/reference/SERVER_REFERENCE.md).
    remote_script = "; ".join(
        f'curl -sf -m 90 -X POST http://localhost:8000/scrape-search '
        f'-H "content-type: application/json" '
        f'-d \'{{"platform":"{platform}","query":"{query}","limit":10}}\' '
        f'>/tmp/bench_{i}.json 2>/tmp/bench_{i}.err &'
        for i, (platform, query) in enumerate(WORKLOAD)
    )
    ssh(f"rm -f /tmp/bench_*.json /tmp/bench_*.err; {remote_script}")

    start = time.time()
    while True:
        try:
            used_gb, avail_gb = read_mem_gb()
        except SshTransportError as e:
            # A polling hiccup mid-trial isn't itself dangerous (we're only
            # reading, not changing state) — log it and keep polling rather
            # than aborting the whole trial over a single flaky check.
            print(f"    [poll] {e}")
            time.sleep(2)
            continue
        result.mem_samples.append(used_gb)
        result.peak_used_gb = max(result.peak_used_gb, used_gb)

        if avail_gb < mem_floor_gb:
            result.aborted = True
            result.abort_reason = f"available memory dropped to {avail_gb:.2f}Gi (floor={mem_floor_gb}Gi)"
            break

        # done when all background curls have written their output file
        done_count = ssh("ls /tmp/bench_*.json 2>/dev/null | wc -l")
        if int(done_count or 0) >= len(WORKLOAD):
            break
        # Generous ceiling: at low RENDERS, 9 calls (some capped at 90s each,
        # e.g. StockX/Vestiaire) can legitimately take several serialized
        # rounds through a small semaphore. This must not be tighter than
        # that worst case or a slow-but-healthy low-concurrency trial gets
        # mislabeled as a failure.
        if time.time() - start > 400:
            result.timed_out = True
            result.abort_reason = "workload did not finish within 400s"
            break
        time.sleep(2)

    result.duration_s = time.time() - start

    if result.aborted or result.timed_out:
        # Always clear stray background curls before the next trial restarts
        # the sidecar — an orphaned request from this trial must not bleed
        # into the next trial's timing/memory numbers.
        ssh("pkill -f 'curl.*scrape-search' || true")
    if not result.aborted:
        for i in range(len(WORKLOAD)):
            err = ssh(f"cat /tmp/bench_{i}.err 2>/dev/null")
            if err.strip():
                result.errors += 1

    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirm", action="store_true", help="actually run against production (default: dry-run/print plan only)")
    parser.add_argument("--values", default="2,3,4,5,6", help="comma-separated RENDERS values to test, ascending")
    parser.add_argument("--baseline", type=int, default=3, help="known-safe value to restore to when done")
    parser.add_argument("--mem-floor-gb", type=float, default=1.0, help="abort a trial if available memory drops below this")
    args = parser.parse_args()

    values = [int(v) for v in args.values.split(",")]

    print(f"Plan: test SIDECAR_MAX_CONCURRENT_RENDERS = {values}")
    print(f"Workload per trial: {len(WORKLOAD)} scrape-search calls (spanning fast + slow-CSR platforms)")
    print(f"Safety floor: abort trial if available memory < {args.mem_floor_gb}Gi")
    print(f"Will restore RENDERS={args.baseline} when finished (or on error/Ctrl-C)")
    print()

    if not args.confirm:
        print("Dry run only. Re-run with --confirm to actually execute against production.")
        print("Recommended: run during low-traffic hours (check active-user patterns in docs/HANDOFF.md).")
        return

    results: list[TrialResult] = []
    try:
        for renders in values:
            print(f"--- Testing RENDERS={renders} ---")
            r = run_trial(renders, args.mem_floor_gb)
            results.append(r)
            status = "ABORTED: " + r.abort_reason if r.aborted else ("TIMED OUT: " + r.abort_reason if r.timed_out else "ok")
            print(f"  duration={r.duration_s:.1f}s peak_used={r.peak_used_gb:.2f}Gi errors={r.errors} [{status}]")
            if r.aborted:
                print(f"  Stopping sweep early — RENDERS={renders} is unsafe. Not testing higher values.")
                break
    finally:
        restore_baseline_or_die(args.baseline)

    print("\n=== Summary ===")
    print(f"{'RENDERS':<10}{'duration_s':<12}{'peak_used_Gi':<14}{'errors':<8}{'status'}")
    for r in results:
        status = "ABORTED" if r.aborted else ("TIMED OUT" if r.timed_out else "ok")
        print(f"{r.renders:<10}{r.duration_s:<12.1f}{r.peak_used_gb:<14.2f}{r.errors:<8}{status}")

    print("\n=== JSON ===")
    print(json.dumps([{
        "renders": r.renders, "duration_s": r.duration_s, "peak_used_gb": r.peak_used_gb,
        "errors": r.errors, "aborted": r.aborted, "timed_out": r.timed_out, "abort_reason": r.abort_reason,
    } for r in results], indent=2))


if __name__ == "__main__":
    main()
