import os
from dotenv import load_dotenv
from firecrawl import Firecrawl

load_dotenv()

api_key = os.getenv("FIRECRAWL_API_KEY")
if not api_key:
    raise ValueError("FIRECRAWL_API_KEY not found in .env")

app = Firecrawl(api_key=api_key)

SITES = [
    ("StockX",   "https://stockx.com/search?s=fear+of+god"),
    ("Poshmark", "https://poshmark.com/category/Women-Tops"),
    ("Depop",    "https://www.depop.com/category/womens/"),
]

for name, url in SITES:
    print(f"\n{'='*50}")
    print(f"  {name}: {url}")
    print(f"{'='*50}")
    try:
        result = app.scrape(url, formats=["markdown"])
        content = result.markdown or ""
        status = "SUCCESS" if len(content) > 200 else "LIKELY BLOCKED (thin content)"
        print(f"  Status : {status}")
        print(f"  Length : {len(content)} chars")
        print(f"  Preview: {content[:300].strip()!r}")
    except Exception as e:
        print(f"  Status : ERROR")
        print(f"  Error  : {e}")
