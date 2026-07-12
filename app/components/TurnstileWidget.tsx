'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Script from 'next/script';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export interface TurnstileHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
}

// Explicit render mode (not the auto data-sitekey div) so we can reset the
// widget for a fresh token after every submit — Turnstile tokens are
// single-use and expire in ~5 minutes.
const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onToken }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
      },
    }));

    function renderWidget() {
      if (!SITE_KEY || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    }

    useEffect(() => {
      if (window.turnstile) renderWidget();
      return () => {
        if (widgetIdRef.current) {
          window.turnstile?.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!SITE_KEY) return null;

    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={renderWidget}
        />
        <div ref={containerRef} className="flex justify-center" />
      </>
    );
  }
);

export default TurnstileWidget;
