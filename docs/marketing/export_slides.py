"""
Export slides from any set folder as PNGs.

Usage:
  crawl4ai-service/venv/bin/python3 docs/marketing/export_slides.py <set-folder>

Example:
  crawl4ai-service/venv/bin/python3 docs/marketing/export_slides.py docs/marketing/tiktok-pov

Conventions:
  - Set folder must contain exactly one .html file
  - Slides are named: <set-folder-name>-slide-NN-<text-slug>.png
  - Images are saved alongside the HTML file in the set folder
"""

import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright


def slugify(text: str, max_words: int = 5) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    words = text.split()[:max_words]
    return "-".join(words)


def export(set_dir: Path) -> None:
    html_files = list(set_dir.glob("*.html"))
    if not html_files:
        raise FileNotFoundError(f"No .html file found in {set_dir}")
    if len(html_files) > 1:
        raise ValueError(f"Multiple .html files in {set_dir} — put each set in its own folder")

    html_file = html_files[0]
    set_name = set_dir.name

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 2400, "height": 800})
        page.goto(f"file://{html_file.resolve()}")
        page.wait_for_load_state("networkidle")

        slides = page.query_selector_all(".slide")
        print(f"Found {len(slides)} slides in '{set_name}'")

        for i, slide in enumerate(slides, start=1):
            # Grab visible text for slug; fall back to index only
            raw_text = slide.inner_text().strip()
            slug = slugify(raw_text) if raw_text else f"slide-{i:02d}"
            filename = f"{set_name}-slide-{i:02d}-{slug}.png"
            out = set_dir / filename
            slide.screenshot(path=str(out))
            print(f"  {filename}")

        browser.close()

    print(f"\nDone — images saved to {set_dir}/")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 export_slides.py <set-folder>")
        sys.exit(1)

    target = Path(sys.argv[1]).resolve()
    if not target.is_dir():
        print(f"Error: '{target}' is not a directory")
        sys.exit(1)

    export(target)
