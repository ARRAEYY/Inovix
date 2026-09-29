const express = require('express');
const { protect, authorizeRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../lib/constants');
const prisma = require('../lib/prisma');
const { audit } = require('../lib/audit');
const { z } = require('zod');

const router = express.Router();

// ─── Student: create a dispute ────────────────────────────────────────────
router.post('/', protect, authorizeRole(ROLES.STUDENT), async (req, res, next) => {
  try {
    const { orderId, type, description } = req.body;
    if (!orderId || !type || !description) {
      return res.status(400).json({ success: false, message: 'orderId, type, and description are required' });
    }
    // Verify the order belongs to the student
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.studentId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your order' });
    }
    // One dispute per order (orderId is @unique)
    const dispute = await prisma.dispute.upsert({
      where: { orderId },
      create: { orderId, userId: req.user.id, outletId: order.outletId, type, description },
      update: { type, description, status: 'OPEN', resolution: null },
    });
    res.status(201).json({ success: true, data: dispute });
  } catch (err) { next(err); }
});

// ─── Student: list their disputes ─────────────────────────────────────────
router.get('/mine', protect, authorizeRole(ROLES.STUDENT), async (req, res, next) => {
  try {
    const disputes = await prisma.dispute.findMany({
      where: { userId: req.user.id },
      include: { order: { select: { orderNumber: true, status: true, totalAmount: true } }, outlet: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: disputes });
  } catch (err) { next(err); }
});

// ─── Admin: list all disputes ─────────────────────────────────────────────
router.get('/', protect, authorizeRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const disputes = await prisma.dispute.findMany({
      include: {
        order: { select: { orderNumber: true, status: true, totalAmount: true } },
        outlet: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: disputes });
  } catch (err) { next(err); }
});

// ─── Admin: resolve a dispute ─────────────────────────────────────────────
router.patch('/:id', protect, authorizeRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { status, resolution } = req.body;
    if (!status || !['RESOLVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be RESOLVED or REJECTED' });
    }
    const dispute = await prisma.dispute.update({
      where: { id: req.params.id },
      data: { status, resolution: resolution || null },
    });
    await audit({ actorId: req.user.id, action: 'DISPUTE_RESOLVED', targetType: 'Dispute', targetId: dispute.id, after: { status, resolution }, req });
    res.json({ success: true, data: dispute });
  } catch (err) { next(err); }
});

module.exports = router;
