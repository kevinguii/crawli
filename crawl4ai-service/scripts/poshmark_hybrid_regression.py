"""Offline regression for the hybrid extract_poshmark, no network.

Runs against the 12 saved dumps in debug_dumps/poshmark_jsonld/ (6 available +
6 sold, captured by poshmark_jsonld_probe.py). Verifies:
  1. Tier-1 JSON-LD path: every dump yields a dict with price + condition + the
     expected isSold (available=False, sold=True, inferred from the filename's
     sold-list capture or the inventory_status attr in the HTML).
  2. Tier-2 legacy fallback: strip the JSON-LD <script> tags from a sample and
     confirm extract_poshmark still returns price/title/isSold via the og/h1 path.
  3. Tier-3: empty/garbage HTML -> None.

Run from crawl4ai-service:
    ./venv/bin/python scripts/poshmark_hybrid_regression.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from structured_extractors import extract_poshmark  # noqa: E402

DUMP_DIR = Path(__file__).resolve().parent.parent / "debug_dumps" / "poshmark_jsonld"


def truth_is_sold(html: str) -> bool | None:
    m = re.search(r'data-et-prop-inventory_status="([^"]*)"', html)
    if not m:
        return None
    return "sold" in m.group(1).lower()


def strip_jsonld(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        tag.decompose()
    return str(soup)


def main() -> None:
    dumps = sorted(DUMP_DIR.glob("*.html"))
    if not dumps:
        print(f"No dumps in {DUMP_DIR}, run poshmark_jsonld_probe.py first.")
        return

    print(f"=== TIER 1 (JSON-LD): {len(dumps)} saved dumps ===")
    n_ok = n_cond = n_sold_match = n_price = 0
    legacy_sample_avail = legacy_sample_sold = None
    for p in dumps:
        html = p.read_text()
        truth = truth_is_sold(html)
        res = extract_poshmark(html)
        ok = res is not None
        cond = res.get("condition") if res else None
        issold = res.get("isSold") if res else None
        price = res.get("price") if res else None
        sold_match = (truth is None) or (bool(issold) == bool(truth))
        n_ok += ok
        n_cond += bool(cond)
        n_price += price is not None
        n_sold_match += sold_match
        flag = "" if (ok and sold_match and cond and price is not None) else "  <-- CHECK"
        print(f"  {p.name[:48]:48} dict={ok} price={price} isSold={issold} "
              f"truth={truth} cond={cond}{flag}")
        if truth is False and legacy_sample_avail is None:
            legacy_sample_avail = (p.name, html)
        if truth is True and legacy_sample_sold is None:
            legacy_sample_sold = (p.name, html)

    print(f"\n  dicts={n_ok}/{len(dumps)}  price={n_price}/{len(dumps)}  "
          f"condition={n_cond}/{len(dumps)}  isSold-matches-truth={n_sold_match}/{len(dumps)}")

    print("\n=== TIER 2 (legacy fallback: JSON-LD stripped) ===")
    for label, sample in (("available", legacy_sample_avail), ("sold", legacy_sample_sold)):
        if not sample:
            print(f"  ({label}: no sample)")
            continue
        name, html = sample
        stripped = strip_jsonld(html)
        # sanity: confirm we actually removed the JSON-LD
        has_ld = "application/ld+json" in stripped
        res = extract_poshmark(stripped)
        print(f"  [{label}] {name[:44]:44} jsonld_present_after_strip={has_ld} -> {res}")

    print("\n=== TIER 3 (garbage -> None) ===")
    for label, h in (("empty", ""), ("non-product", "<html><head></head><body>blocked</body></html>")):
        print(f"  [{label}] -> {extract_poshmark(h)}")


if __name__ == "__main__":
    main()
