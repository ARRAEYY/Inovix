/**
 * Sentry server-side init (Node.js runtime — RSCs, server actions, API routes).
 *
 * Auto-imported by `withSentryConfig`. Must call `Sentry.init()` at module
 * scope; the SDK handles the rest of the instrumentation at build time.
 *
 * Same no-op rule as the client config: skip init when no DSN is set so we
 * don't crash the dev server or print warnings to the console.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Server-side tracing can be chatty; cap at 20% in prod.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    // Don't capture the noisy /api/auth/refresh 401s that the frontend
    // treats as routine — they flood Sentry when tokens expire.
    ignoreErrors: [
      'refresh token not found',
      'invalid refresh token',
      'jwt expired',
      'jwt malformed',
    ],
  });
}
