# crawl4ai sidecar

A small FastAPI service that replaces Firecrawl's `scrape()` call. The Next.js
app hits `POST http://localhost:8000/scrape` instead of Firecrawl. Search still
goes to Firecrawl (see `lib/firecrawl.ts`).

## One-time setup

```bash
cd crawl4ai-service
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# crawl4ai needs Playwright + its post-install hook
python -m playwright install chromium
crawl4ai-setup

cp .env.example .env
# edit .env when you have an LLM key — leave LLM_PROVIDER blank to start in stub mode
```

## Run

```bash
source venv/bin/activate
uvicorn main:app --port 8000 --reload
```

Or from the project root: `npm run dev:sidecar`.

## Endpoints

### `GET /health`

```json
{ "status": "ok", "llm_mode": "stub", "provider": null }
```

`llm_mode` is `"active"` when `LLM_PROVIDER` + the matching API key are both set,
otherwise `"stub"`.

### `POST /scrape`

Request:
```json
{ "url": "https://www.grailed.com/listings/12345", "platform": "grailed" }
```

Response (LLM mode):
```json
{
  "result": {
    "url": "https://www.grailed.com/listings/12345",
    "title": "Rick Owens DRKSHDW Hoodie",
    "price": 220,
    "currency": "USD",
    "isSold": false,
    "condition": "Used",
    "imageUrl": "https://..."
  }
}
```

Response (stub mode — no API key configured):
```json
{
  "result": {
    "url": "...",
    "title": "<page title from <head>>",
    "price": null,
    "currency": "USD",
    "isSold": false,
    "condition": null,
    "imageUrl": null
  }
}
```

On any failure (crawl error, LLM error, parsing error), the response is
`{ "result": null }` — matching the original `catch → return null` behaviour
in `lib/firecrawl.ts`.

## Switching LLM providers

Set `LLM_PROVIDER` in `.env`. Examples:

| Provider  | `LLM_PROVIDER`                          | Key env var       |
|-----------|-----------------------------------------|-------------------|
| Anthropic | `anthropic/claude-sonnet-4-5`           | `ANTHROPIC_API_KEY` |
| OpenAI    | `openai/gpt-4o-mini`                    | `OPENAI_API_KEY`    |
| Gemini    | `gemini/gemini-2.0-flash`               | `GEMINI_API_KEY`    |
| Groq      | `groq/llama-3.3-70b-versatile`          | `GROQ_API_KEY`      |
| Ollama    | `ollama/llama3.1`                       | (none, local)       |

Restart the sidecar after editing `.env`. No code change needed.
