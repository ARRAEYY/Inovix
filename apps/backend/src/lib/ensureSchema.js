/**
 * ensureSchema.js — lightweight, self-healing database schema synchronizer.
 *
 * Runs on server boot to ensure any columns introduced in recent Prisma migrations
 * (such as Order.orderType and Outlet contact fields) are safely present in Postgres
 * without requiring interactive migration locks.
 */

const prisma = require('./prisma');

async function ensureSchema() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderType" TEXT NOT NULL DEFAULT 'TAKEAWAY'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Outlet" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Outlet" ADD COLUMN IF NOT EXISTS "contactNumber" TEXT`);
    console.log('[db] schema check passed: Order.orderType and Outlet contact fields verified');
    return { success: true };
  } catch (err) {
    console.warn('[db] schema check warning:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { ensureSchema };
