import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly. Without this, Turbopack auto-detects the
  // root by walking up for a lockfile and finds two (this worktree's and the
  // main repo's, since git worktrees keep their own package-lock.json) — it then
  // guesses the main repo as root while actually serving files from this
  // worktree, corrupting the RSC debug/source-map info Turbopack attaches to
  // each module. That mismatch is what caused the intermittent dev-only crash
  // "TypeError: frame.join is not a function" (React's owner-stack builder
  // reading malformed frame data) seen 2026-08-17 running dev from this worktree.
  turbopack: {
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    // Baseline security headers (flagged by Bing's trust-signal guidance and a
    // general gap — site had none). No CSP here: a strict policy risks silently
    // breaking Stripe checkout, the Sentry tunnel (/monitoring), and GA4 without
    // careful per-directive scoping — add separately once audited. No HSTS
    // preload either — that's a one-way door via browser preload lists.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "crawli",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
