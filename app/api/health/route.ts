import { NextResponse } from 'next/server';

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8000';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (token !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${SIDECAR_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Sidecar returned non-200 status',
          sidecar_status: response.status,
        },
        { status: 503 }
      );
    }

    const sidecarHealth = await response.json();

    return NextResponse.json({
      status: sidecarHealth.crawler_alive ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      sidecar: {
        crawler_alive: sidecarHealth.crawler_alive,
        pool_alive: sidecarHealth.pool_alive,
        pool_size: sidecarHealth.pool_size,
        in_flight: sidecarHealth.in_flight,
        llm_mode: sidecarHealth.llm_mode,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[health] Sidecar unreachable:', message);

    return NextResponse.json(
      {
        status: 'error',
        message: 'Sidecar unreachable',
        error: message,
      },
      { status: 503 }
    );
  }
}
