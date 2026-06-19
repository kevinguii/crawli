#!/usr/bin/env python3
"""Generate flat clipart PNGs via OpenAI GPT Image (gpt-image-2 by default).

Reads OPENAI_API_KEY from the shell env or the nearest .env (walks up).
No external deps (urllib only).

Usage:
  python3 gen-clipart.py --prompt "..." --out ai-images/rack.png \
      --model gpt-image-2 --quality medium --size 1024x1024 [--transparent]
"""
import sys, os, json, base64, urllib.request, urllib.error, argparse


def load_key():
    k = os.environ.get("OPENAI_API_KEY")
    if k:
        return k.strip().strip('"').strip("'")
    here = os.path.dirname(os.path.abspath(__file__))
    for _ in range(7):
        p = os.path.join(here, ".env")
        if os.path.isfile(p):
            for line in open(p):
                if line.startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
        here = os.path.dirname(here)
    return None


# Preamble prepended per --style. `photo` is for full-bleed social covers/slides:
# a real photographic image with NO text baked in (the headline is overlaid in
# HTML) and the frame left calm enough for that overlay to read.
PHOTO_PREAMBLE = (
    "Editorial photographic image for a secondhand-fashion social post. "
    "Natural light, realistic textures, shallow depth of field, magazine-quality. "
    "Absolutely no text, no words, no letters, no logos, no watermarks anywhere in the image. "
    "Composition leaves the upper-center area relatively clean and low-contrast so a bold headline can be overlaid on top. "
    "Subject: "
)
CLIPART_PREAMBLE = (
    "Flat vector clipart, bold simple shapes, clean solid colors, no gradients, no text. "
    "Subject: "
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="gpt-image-2")
    ap.add_argument("--size", default=None)            # default depends on --style; 1024x1024 | 1024x1536 | 1536x1024
    ap.add_argument("--quality", default="medium")     # low | medium | high
    ap.add_argument("--transparent", action="store_true")
    ap.add_argument("--style", default="raw", choices=["raw", "photo", "clipart"],
                    help="photo = full-bleed photographic cover/slide (portrait default, no baked text); "
                         "clipart = flat vector preamble; raw = use --prompt verbatim (default)")
    a = ap.parse_args()

    key = load_key()
    if not key:
        sys.exit("ERROR: no OPENAI_API_KEY found in env or .env")

    prompt = a.prompt
    if a.style == "photo":
        prompt = PHOTO_PREAMBLE + prompt
    elif a.style == "clipart":
        prompt = CLIPART_PREAMBLE + prompt

    # Covers/photo slides are portrait (4:5-ish); clipart/raw default square.
    size = a.size or ("1024x1536" if a.style == "photo" else "1024x1024")

    body = {"model": a.model, "prompt": prompt, "size": size,
            "quality": a.quality, "n": 1, "output_format": "png"}
    if a.transparent:
        body["background"] = "transparent"

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:1500]}")
    except Exception as e:
        sys.exit(f"ERROR: {e}")

    b64 = data["data"][0]["b64_json"]
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "wb") as f:
        f.write(base64.b64decode(b64))
    print("saved", a.out)
    if "usage" in data:
        print("usage", json.dumps(data["usage"]))


if __name__ == "__main__":
    main()
