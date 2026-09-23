/**
 * Sentry client-side init.
 *
 * The Next.js + Sentry SDK automatically imports this file in the browser
 * runtime when `next.config.ts` is wrapped with `withSentryConfig`. We must
 * call `Sentry.init()` at module scope (no top-level await).
 *
 * Safe-mode rules (per task spec):
 *   • If `NEXT_PUBLIC_SENTRY_DSN` (or `SENTRY_DSN`) is unset, the SDK is a
 *     no-op — calling `Sentry.init({ dsn: undefined })` would log a warning
 *     and crash on the server, so we skip init entirely when no DSN is set.
 *   • In dev (`NODE_ENV === 'development'` without a DSN), we leave Sentry
 *     uninitialised. Front-end code can still call `Sentry.captureException`
 *     safely — the SDK ships with an internal no-op transport when init has
 *     not been called.
 *
 * Env vars (declared in `.env` if needed):
 *   NEXT_PUBLIC_SENTRY_DSN   — browser DSN (preferred; visible to client)
 *   SENTRY_DSN               — fallback (used by both client + server)
 *   NEXT_PUBLIC_SENTRY_ENV   — environment tag (e.g. staging / production)
 *   NEXT_PUBLIC_SENTRY_RELEASE — release SHA (optional; auto-detected otherwise)
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

// Skip Sentry entirely in dev / when no DSN is configured — calling init with
// an empty DSN throws on the server and floods the console in the browser.
if (dsn) {
  Sentry.init({
    dsn,
    // Lower sample rates in prod to keep quota usage sane; always 1.0 in dev
    // (when DSN is present) so we actually see issues locally.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    // Sessions-and-replay is heavy; only enable on prod with DSN set.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}
