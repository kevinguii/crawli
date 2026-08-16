// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://98f1b00078a83a19960c3a3d3dbaa0bd@o4511449671663616.ingest.us.sentry.io/4511449672843264",
  environment: process.env.NODE_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  debug: false,

  // Noise from in-app browsers' own injected scripts (e.g. Instagram/Facebook's
  // native bridge), not Crawli code. Confirmed via Sentry issue 868d9b1f
  // (2026-07-11): fires from a synthetic app:///:1 stack, no reference to this
  // function anywhere in the codebase.
  //
  // "NotFoundError: The object can not be found here." (DOMException code 8):
  // Mobile Safari removeChild race, always `handled: true` (React's own error
  // recovery caught it — no crash, no broken UI). Confirmed 2026-08-15 (issues
  // 5f0d552d / e662b049, /alerts and /search): grepped app/lib/components for
  // removeChild/appendChild/insertBefore — the only DOM-node-producing pattern
  // in the app is FilterPanel.tsx's createPortal(..., document.body), which is
  // the idiomatic React API and doesn't manually touch node removal. This is
  // the well-documented Safari class of error where autofill/extension/reader
  // UI mutates the DOM outside React's control; not reproducible or fixable
  // from application code.
  ignoreErrors: [
    "window.webkit.messageHandlers",
    "The object can not be found here.",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
