import { NextResponse } from 'next/server';

const SIDECAR_URL = process.env.CRAWL4AI_URL ?? 'http://localhost:8000';
const SMOKE_QUERY = 'nike air force 1';
const SMOKE_PLATFORM = 'grailed';
const MIN_RESULTS = 1;

export async function GET() {
  const started = Date.now();

  try {
    const res = await fetch(`${SIDECAR_URL}/scrape-search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: SMOKE_PLATFORM, query: SMOKE_QUERY, limit: 5 }),
      signal: AbortSignal.timeout(45_000),
    });

    const elapsed = Date.now() - started;

    if (!res.ok) {
      return NextResponse.json(
        { status: 'fail', reason: `sidecar returned ${res.status}`, elapsed_ms: elapsed },
        { status: 503 }
      );
    }

    const data = await res.json() as { results: unknown[] };
    const count = data.results?.length ?? 0;

    if (count < MIN_RESULTS) {
      return NextResponse.json(
        { status: 'fail', reason: `got ${count} results, expected >=${MIN_RESULTS}`, elapsed_ms: elapsed },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: 'ok', results: count, elapsed_ms: elapsed });
  } catch (err) {
    const elapsed = Date.now() - started;
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { status: 'fail', reason: message, elapsed_ms: elapsed },
      { status: 503 }
    );
  }
}
