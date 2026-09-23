import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Forward /api/* to the Inovix backend on port 3001 when the request
  // carries the XTransformPort query (the gateway contract). This lets
  // the dev server (port 3000) work as a direct preview without relying
  // on the Caddy gateway on port 81.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        has: [{ type: "query", key: "XTransformPort" }],
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

// ─── Sentry build-time config ────────────────────────────────────────────────
//
// `withSentryConfig` is a no-op at runtime when no DSN is set in
// `sentry.{client,server,edge}.config.ts`. The options below only affect
// the production build (source map upload, automatic instrumentation) and
// are skipped in dev (`bun run dev`).
export default withSentryConfig(nextConfig, {
  // Suppress console output from the Sentry webpack plugin in dev so the
  // terminal stays readable.
  silent: true,
  // Auto-instrument server functions, middleware and App-Directory routes.
  // These live under `webpack.*` in v10+ (the top-level keys are deprecated
  // and will be removed in v11). They are no-ops under Turbopack.
  webpack: {
    autoInstrumentServerFunctions: true,
    autoInstrumentMiddleware: true,
    autoInstrumentAppDirectory: true,
  },
  // Hide source map upload warnings in dev — we don't upload maps locally.
  // In prod, this only fires if SENTRY_AUTH_TOKEN is configured.
  hideSourceMaps: true,
  // Tree-shake Sentry logger statements from production bundles.
  treeshake: {
    removeDebugLogging: true,
  },
});
