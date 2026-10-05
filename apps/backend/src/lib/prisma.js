/**
 * Prisma client singleton.
 *
 * Hot-reload in dev creates multiple PrismaClient instances that exhaust the
 * connection pool. This file guards against that by stashing the instance on
 * globalThis.
 *
 * Per Rule: every outlet-scoped Prisma query MUST include a where: { outletId }
 * filter when called from a non-super-admin context. The repository layer
 * enforces this; this file just hands out the client.
 */

const { PrismaClient } = require('@prisma/client');

function getOptimizedDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    // If connecting to Supabase pooler (port 6543 or pooler.supabase.com)
    if (parsed.port === '6543' || parsed.hostname.includes('pooler.supabase.com')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    // Set pool connection limits so connections stay pre-warmed and concurrent
    if (!parsed.searchParams.has('connection_limit') || parsed.searchParams.get('connection_limit') === '1') {
      parsed.searchParams.set('connection_limit', '10');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '10');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const optimizedUrl = getOptimizedDatabaseUrl();

const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    datasources: optimizedUrl ? { db: { url: optimizedUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
} else {
  // Pre-warm database connection pool on server startup so the first request doesn't wait
  prisma.$connect().then(() => {
    console.log('[prisma] Connection pool pre-warmed and ready (connection_limit=10).');
  }).catch((err) => {
    console.error('[prisma] Pre-warm connection failed:', err.message);
  });
}

module.exports = prisma;
