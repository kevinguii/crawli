// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://98f1b00078a83a19960c3a3d3dbaa0bd@o4511449671663616.ingest.us.sentry.io/4511449672843264",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: true,
  debug: false,
});
