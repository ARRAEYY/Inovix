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

const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

module.exports = prisma;
