/**
 * Audit log helper.
 *
 * Spec ref: §4 entity #19, §3 enforcement Layer 3.
 * Every state-changing outlet/admin operation MUST write one AuditLog row.
 *
 * Usage:
 *   await audit({
 *     actorId: req.user.id,
 *     action: 'ORDER_STATUS_CHANGED',
 *     targetType: 'Order',
 *     targetId: order.id,
 *     before: { status: 'PENDING' },
 *     after:  { status: 'ACCEPTED' },
 *     req,
 *   });
 *
 * The `req` argument is optional; if provided, IP + User-Agent are recorded.
 */

const prisma = require('./prisma');

async function audit({ actorId, action, targetType, targetId, before, after, req }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorId || null,
        action: action || 'UNKNOWN',
        targetType: targetType || 'Unknown',
        targetId: targetId || null,
        before: before == null ? '{}' : JSON.stringify(before),
        after:  after == null ? '{}' : JSON.stringify(after),
        ip: req?.ip || req?.socket?.remoteAddress || null,
        userAgent: req?.get?.('user-agent') || null,
      },
    });
  } catch (err) {
    // The audit log must never break the request it is recording.
    console.error('[audit] failed to write audit log:', err.message);
  }
}

/**
 * Read audit logs with pagination. Used by the super-admin audit endpoint.
 */
async function listAudit({ page = 1, pageSize = 50, targetType, targetId, actorUserId, action } = {}) {
  // Coerce — query params may arrive as strings if Express didn't parse them
  const pNum = Number(page) || 1;
  const psNum = Number(pageSize) || 50;
  const where = {};
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (actorUserId) where.actorUserId = actorUserId;
  if (action) where.action = { contains: action };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pNum - 1) * psNum,
      take: psNum,
      include: { actor: { select: { id: true, email: true, name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page: pNum, pageSize: psNum };
}

module.exports = { audit, listAudit };
