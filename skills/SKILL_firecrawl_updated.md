---
name: firecrawl
description: |
  Firecrawl API reference and developer guide for integrating web scraping,
  searching, and interaction capabilities into applications. Complete endpoint
  documentation with parameters, response schemas, SDKs, and error handling.
---

# Firecrawl Developer Reference

Complete API reference for building web scraping and search applications with Firecrawl.

## Quick Start

**Get an API key:** https://www.firecrawl.dev/signin?view=signup&source=developer

**Base URL:** `https://api.firecrawl.dev/v2`

**Authentication:** `Authorization: Bearer fc-YOUR_API_KEY`

**SDKs:** Python, Node.js, Go, Rust, Java, Elixir, Ruby, .NET, PHP, and community SDKs available.

---

## Core Endpoints

### 1. Search

Search the web and optionally scrape full content from results.

**Endpoint:** `POST /search`

**Request:**
```json
{
  "query": "firecrawl scraping api",
  "limit": 10,
  "location": "San Francisco,California,United States",
  "country": "US",
  "sources": [{"type": "web"}],
  "categories": [],
  "scrapeOptions": {
    "formats": [{"type": "markdown"}]
  }
}
```

**Key Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query (max 500 chars) |
| `limit` | integer | 10 | Max results per source (1-100) |
| `location` | string | optional | Geo-targeted location |
| `country` | string | US | ISO country code (e.g., US, DE, FR, JP) |
| `sources` | array | ["web"] | Result types: `web`, `images`, `news` |
| `categories` | array | [] | Filter by: `github`, `research`, `pdf` |
| `tbs` | string | optional | Time-based: `qdr:h`, `qdr:d`, `qdr:w`, `qdr:m`, `qdr:y` |
| `scrapeOptions` | object | {} | Scrape params for each result (see Scrape) |
| `ignoreInvalidURLs` | boolean | false | Exclude invalid URLs from results |
| `timeout` | integer | 60000 | Request timeout in ms (max 300000) |

**Operators in Queries:**

| Operator | Example |
|----------|---------|
| `""` (exact match) | `"exact phrase"` |
| `-` (exclude) | `-bad`, `-site:example.com` |
| `site:` | `site:github.com firecrawl` |
| `filetype:` | `filetype:pdf`, `-filetype:pdf` |
| `inurl:` | `inurl:api` |
| `allinurl:` | `allinurl:git repository` |
| `intitle:` | `intitle:API` |
| `allintitle:` | `allintitle:rest api` |
| `related:` | `related:example.com` |

**Response (simplified):**
```json
{
  "success": true,
  "data": {
    "web": [
      {
        "url": "https://example.com",
        "title": "Page Title",
        "description": "Page description",
        "markdown": "Full markdown content (if scrapeOptions included)",
        "metadata": {
          "title": "...",
          "description": "...",
          "statusCode": 200
        }
      }
    ],
    "images": [],
    "news": []
  },
  "id": "job-id-here",
  "creditsUsed": 5
}
```

**Code Example (Node.js):**
```javascript
const { FirecrawlSDK } = require('@firecrawl/sdk');

const client = new FirecrawlSDK({ apiKey: process.env.FIRECRAWL_API_KEY });

const result = await client.search({
  query: "best coffee shops in sf",
  limit: 5,
  scrapeOptions: {
    formats: ["markdown"]
  }
});

console.log(result.data.web);
```

---

### 2. Scrape

Extract content from a single URL in multiple formats with optional pre-scrape actions.

**Endpoint:** `POST /scrape`

**Request:**
```json
{
  "url": "https://example.com",
  "formats": [
    {"type": "markdown"},
    {"type": "screenshot", "fullPage": true, "quality": 80},
    {
      "type": "json",
      "schema": {
        "type": "object",
        "properties": {
          "title": {"type": "string"},
          "price": {"type": "number"}
        }
      }
    }
  ],
  "onlyMainContent": true,
  "waitFor": 0,
  "timeout": 30000,
  "maxAge": 172800000,
  "mobile": false,
  "actions": [
    {"type": "wait", "selector": ".product-loaded"},
    {"type": "click", "selector": ".load-more"},
    {"type": "wait", "milliseconds": 1000}
  ],
  "headers": {},
  "location": {"country": "US"},
  "blockAds": true,
  "proxy": "auto"
}
```

**Key Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | URL to scrape |
| `formats` | array | ["markdown"] | Output formats (see below) |
| `onlyMainContent` | boolean | true | Exclude nav, headers, footers |
| `waitFor` | integer | 0 | Delay before scrape (ms) |
| `timeout` | integer | 30000 | Request timeout (ms, max 300000) |
| `maxAge` | integer | 172800000 | Cache max age (ms, ~2 days) |
| `mobile` | boolean | false | Emulate mobile device |
| `actions` | array | [] | Pre-scrape actions (click, wait, etc) |
| `headers` | object | {} | Custom headers, cookies, user-agent |
| `skipTlsVerification` | boolean | true | Skip SSL verification |
| `removeBase64Images` | boolean | true | Remove base64 encoded images |
| `blockAds` | boolean | true | Enable ad/popup blocking |
| `proxy` | string | auto | Proxy type: `basic`, `enhanced`, `auto` |
| `storeInCache` | boolean | true | Store in Firecrawl cache |

**Output Formats:**

| Format | Description | Notes |
|--------|-------------|-------|
| `markdown` | Clean markdown | Default, LLM-friendly |
| `html` | Cleaned HTML | Good for complex layouts |
| `rawHtml` | Raw unmodified HTML | Full page source |
| `summary` | LLM-generated summary | Condensed content |
| `screenshot` | Page screenshot (PNG) | Config: fullPage, quality, viewport |
| `links` | Array of URLs | All links found on page |
| `images` | Base64 image data | Warning: can be large |
| `json` | Structured JSON | Requires schema & optional prompt |
| `branding` | Design system data | Colors, fonts, typography, components |
| `audio` | MP3 from video URLs | YouTube, etc. Returns signed GCS URL |
| `changeTracking` | Change detection | Requires: modes (git-diff or json), schema |

**Browser Actions:**

```json
[
  {"type": "wait", "milliseconds": 2000},
  {"type": "wait", "selector": ".data-loaded"},
  {"type": "click", "selector": ".expand-button"},
  {"type": "click", "selector": ".more-items", "all": true},
  {"type": "scroll", "direction": "down", "selector": "#feed"},
  {"type": "write", "text": "search query"},
  {"type": "press", "key": "Enter"},
  {"type": "screenshot", "fullPage": true, "quality": 100},
  {"type": "executeJavascript", "script": "return document.querySelectorAll('.item').length"},
  {"type": "pdf", "format": "A4", "landscape": false}
]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# Page Title\n...",
    "html": "<html>...</html>",
    "screenshot": "https://...(expires 24h)",
    "metadata": {
      "title": "Page Title",
      "description": "...",
      "language": "en",
      "keywords": "...",
      "statusCode": 200,
      "sourceURL": "https://example.com",
      "url": "https://example.com/final-url"
    },
    "actions": {
      "screenshots": ["https://..."],
      "scrapes": [{"url": "...", "html": "..."}],
      "javascriptReturns": [{"type": "number", "value": 42}],
      "pdfs": ["base64-pdf-data"]
    }
  }
}
```

**Code Example (Python):**
```python
from firecrawl import Firecrawl

client = Firecrawl(api_key="fc-YOUR-API-KEY")

# Simple scrape
result = client.scrape("https://example.com", formats=["markdown"])
print(result['data']['markdown'])

# Complex scrape with actions and JSON extraction
result = client.scrape(
    "https://example.com/products",
    formats=[
        "markdown",
        {
            "type": "json",
            "schema": {
                "type": "object",
                "properties": {
                    "products": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "price": {"type": "number"},
                                "inStock": {"type": "boolean"}
                            }
                        }
                    }
                }
            }
        }
    ],
    actions=[
        {"type": "wait", "selector": ".products-loaded"},
        {"type": "click", "selector": ".load-more"}
    ]
)

print(result['data']['markdown'])
```

---

### 3. Interact

Continue working with a scraped page—click, fill forms, execute code, extract dynamic content.

**Endpoint:** `POST /scrape` (initial) + `POST /scrape/execute` (subsequent actions)

**Initial Scrape with Interaction:**
```json
{
  "url": "https://example.com",
  "formats": ["markdown"]
}
```

**Then Interact:**
```
POST /scrape/execute
{
  "scrapeId": "job-id-from-initial-scrape",
  "prompt": "Click the 'next' button and tell me what product is shown"
}
```

Or programmatically:

```javascript
const { FirecrawlSDK } = require('@firecrawl/sdk');

const client = new FirecrawlSDK({ apiKey: process.env.FIRECRAWL_API_KEY });

// 1. Scrape Amazon
const result = await client.scrape("https://www.amazon.com", formats: ["markdown"]);
const scrapeId = result.metadata.scrape_id;

// 2. Interact with the page
const searchResult = await client.interact(scrapeId, {
  prompt: "Search for iPhone 16 Pro Max"
});

// 3. Another action
const priceResult = await client.interact(scrapeId, {
  prompt: "Click the first result and tell me the price"
});

console.log(priceResult.output);

// 4. Stop the session
await client.stopInteraction(scrapeId);
```

**Response:**
```json
{
  "success": true,
  "output": "The iPhone 16 Pro Max (256GB) is priced at $1,199.00.",
  "liveViewUrl": "https://liveview.firecrawl.dev/...",
  "interactiveLiveViewUrl": "https://liveview.firecrawl.dev/...",
  "exitCode": 0,
  "killed": false
}
```

---

### 4. Map

Discover all URLs on a domain.

**Endpoint:** `POST /map`

**Request:**
```json
{
  "url": "https://example.com",
  "limit": 5000,
  "search": "product",
  "ignoreQueryParameters": false
}
```

**Key Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Domain to map |
| `limit` | integer | 5000 | Max URLs to discover |
| `search` | string | optional | Filter by query string |
| `ignoreQueryParameters` | boolean | false | Treat same URL with diff params as one |

**Response:**
```json
{
  "success": true,
  "data": {
    "urls": [
      "https://example.com",
      "https://example.com/about",
      "https://example.com/products",
      "https://example.com/products/item-1"
    ]
  }
}
```

---

### 5. Crawl

Recursively extract content from all pages on a domain.

**Endpoint:** `POST /crawl`

**Request:**
```json
{
  "url": "https://example.com",
  "limit": 100,
  "allowBackendLinks": false,
  "excludePatterns": ["admin", "private"],
  "includePatterns": ["blog"],
  "maxDepth": 2,
  "scrapeOptions": {
    "formats": ["markdown"]
  }
}
```

**Key Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Domain to crawl |
| `limit` | integer | 100 | Max pages to crawl |
| `allowBackendLinks` | boolean | false | Include non-canonical links |
| `excludePatterns` | array | [] | Regex patterns to skip |
| `includePatterns` | array | [] | Regex patterns to include |
| `maxDepth` | integer | 2 | Max recursion depth |
| `scrapeOptions` | object | {} | Format options (see Scrape) |

**Response (Async):**
```json
{
  "success": true,
  "id": "crawl-job-id",
  "status": "in_progress",
  "creditsUsed": 0
}
```

**Get Status:** `GET /crawl/{id}`

**Webhook Support:** Firecrawl sends webhooks when crawl completes and for each page (requires setup).

---

### 6. Batch Scrape

Scrape multiple URLs in parallel.

**Endpoint:** `POST /batch/scrape`

**Request:**
```json
{
  "urls": [
    "https://example.com/page-1",
    "https://example.com/page-2",
    "https://example.com/page-3"
  ],
  "scrapeOptions": {
    "formats": ["markdown", "json"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "id": "batch-job-id",
  "status": "in_progress"
}
```

**Get Results:** `GET /batch/scrape/{id}`

---

### 7. Parse

Upload a local or non-public document (PDF, Word, image) and convert to LLM-ready format.

**Endpoint:** `POST /parse`

**Request (multipart/form-data):**
```
file: <binary PDF/DOC data>
formats: ["markdown", "json"]
schema: <JSON Schema object>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "...",
    "json": {...}
  }
}
```

---

### 8. Ask (Debugging)

Diagnose failing Firecrawl calls using job ID and team logs.

**Endpoint:** `POST /support/ask`

**Request:**
```json
{
  "question": "Why did this scrape fail?",
  "jobId": "job-id-from-failed-request"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "The page required JavaScript to load. Try setting waitFor or using the interact endpoint.",
  "fixParameters": {
    "waitFor": 2000,
    "actions": [{"type": "wait", "selector": ".content"}]
  }
}
```

---

### 9. Docs Search

Search Firecrawl documentation for "how-to" answers.

**Endpoint:** `POST /support/docs-search`

**Request:**
```json
{
  "question": "How do I extract structured JSON from a page?"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Use the 'json' format with a JSON Schema...",
  "citations": [
    {"page": "https://docs.firecrawl.dev/features/scrape", "title": "Scrape Formats"}
  ]
}
```

---

## Advanced Features

### Browser Profiles (Persistent State)

Preserve cookies, localStorage, and session data across scrape/interact sessions:

```json
{
  "url": "https://example.com",
  "formats": ["markdown"],
  "profile": {
    "name": "my-session",
    "saveChanges": true
  }
}
```

### Location Spoofing

Emulate requests from specific countries/languages:

```json
{
  "url": "https://example.com",
  "location": {
    "country": "DE",
    "languages": ["de-DE", "en"]
  }
}
```

### Proxy Modes

- `basic`: Fast, for sites with basic anti-bot (default)
- `enhanced`: Slower, for sites with advanced anti-bot (up to 5 credits/request)
- `auto`: Auto-retry with enhanced if basic fails

### Change Tracking

Monitor page changes between scrapes:

```json
{
  "url": "https://example.com",
  "formats": [
    {
      "type": "changeTracking",
      "modes": ["git-diff"],
      "tag": "daily-monitor"
    }
  ]
}
```

### Zero Data Retention (ZDR)

For compliance-sensitive scraping (contact support@firecrawl.dev):

```json
{
  "url": "https://example.com",
  "zeroDataRetention": true
}
```

### Caching

Firecrawl caches pages for ~2 days by default. Control with:

- `maxAge`: Return cached version if younger than this (ms)
- `minAge`: Only check cache, never fresh scrape (returns 404 if not cached)
- `storeInCache`: false to skip caching

---

## Error Codes & Handling

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| `200` | OK | Success | Process result |
| `400` | Bad Request | Invalid params | Check schema |
| `402` | Payment Required | Credit limit hit | Check usage |
| `404` | Not Found | URL unreachable | Verify URL |
| `408` | Timeout | Request took too long | Retry with longer timeout |
| `429` | Rate Limited | Too many requests | Wait, then retry |
| `500` | Server Error | Firecrawl issue | Retry (up to 3 times) |

**Retry Logic (recommended):**

```javascript
async function scrapeWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.scrape(url);
    } catch (error) {
      if (error.status === 429 || error.status === 500) {
        const backoff = Math.pow(2, i) * 1000; // exponential backoff
        await new Promise(r => setTimeout(r, backoff));
      } else {
        throw error;
      }
    }
  }
}
```

---

## Credit Costs

Approximate credit usage:

| Operation | Cost |
|-----------|------|
| Scrape (basic) | 1 credit |
| Scrape (enhanced proxy) | Up to 5 credits |
| Search (10 results) | 5 credits |
| Crawl (per page) | 1 credit |
| Batch Scrape (per URL) | 1 credit |
| Screenshot | 1 credit |
| PDF Parsing (per page) | 1 credit |

**Monitor usage:** `GET /usage`, `GET /tokens`

---

## Authentication & Environment

Set API key in environment or pass directly:

```bash
# .env file
FIRECRAWL_API_KEY=fc-YOUR_API_KEY
```

```javascript
// Direct
const client = new FirecrawlSDK({
  apiKey: "fc-YOUR_API_KEY"
});
```

---

## SDK Examples

### Python
```python
from firecrawl import Firecrawl

client = Firecrawl(api_key="fc-...")

# Search
results = client.search("python web scraping", limit=5)

# Scrape
data = client.scrape("https://example.com", formats=["markdown", "json"])

# Crawl
crawl_result = client.crawl("https://example.com", limit=50)
```

### Node.js
```javascript
const { FirecrawlSDK } = require('@firecrawl/sdk');

const client = new FirecrawlSDK({ apiKey: "fc-..." });

// Search
const results = await client.search("query", { limit: 10 });

// Scrape
const data = await client.scrape("https://example.com");

// Crawl
const crawl = await client.crawl("https://example.com", { limit: 50 });
```

---

## Best Practices

1. **Always use `onlyMainContent: true`** (default) to avoid noise
2. **Set `timeout` based on page complexity** (default 30s, max 300s)
3. **Use actions to wait for dynamic content** instead of guessing delays
4. **Implement exponential backoff for retries** (429, 500 errors)
5. **Cache results** with `maxAge` to reduce API calls by 500%
6. **Monitor credit usage** with `/usage` endpoint
7. **Test with proxy auto-retry first** before using `enhanced` directly
8. **Use `mobile: true`** for responsive sites to get mobile layout
9. **Batch URLs** instead of individual requests when possible
10. **Parse PDFs locally** if sensitive data (use `/parse` endpoint)

---

## Webhooks

Set up async notifications for long-running jobs (crawl, batch scrape):

**Event types:**
- `crawl.started`
- `crawl.page` (for each page)
- `crawl.completed`
- `batch_scrape.started`
- `batch_scrape.page` (for each URL)
- `batch_scrape.completed`

**Setup:** Configure in dashboard or via API.

---

## MCP Server & Integrations

Use Firecrawl with AI tools via Model Context Protocol:

- **Claude/Claude Code:** MCP server for docs + reference
- **LangChain, LlamaIndex, Vercel AI:** Official integrations
- **Make, Zapier, n8n, Dify:** Workflow automation
- **OpenAI, Anthropic, Gemini:** LLM SDK examples

---

## Resources

- **API Reference:** https://docs.firecrawl.dev/api-reference/v2-introduction
- **Docs:** https://docs.firecrawl.dev
- **Docs Index:** https://docs.firecrawl.dev/llms.txt
- **MCP Server:** https://docs.firecrawl.dev/mcp-server
- **GitHub:** https://github.com/firecrawl/firecrawl
- **Playground:** https://firecrawl.dev/playground
- **Support:** support@firecrawl.dev
