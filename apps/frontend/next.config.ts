import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import path from "path";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Forward /api/* and /socket.io/* to backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${BACKEND_URL}/socket.io/:path*`,
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
});
