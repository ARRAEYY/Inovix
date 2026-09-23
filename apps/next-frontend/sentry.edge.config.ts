/**
 * Sentry Edge-runtime init (middleware, RSC edge runtime, edge API routes).
 *
 * Auto-imported by `withSentryConfig` into edge-runtime bundles. Same
 * no-op rule: skip init when no DSN is set so we don't crash the edge
 * runtime or print warnings.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    autoSessionTracking: true,
  });
}
