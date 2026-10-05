const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { ROLES } = require('../lib/constants');
const { authorizeRole } = require('../middleware/auth.middleware');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { cacheDel } = require('../lib/cache');

const router = express.Router();

// GET /reviews/food/:menuItemId — food-wise review list (any authenticated user)
router.get('/food/:menuItemId', protect, async (req, res, next) => {
  try {
    const reviews = await prisma.menuItemReview.findMany({
      where: { menuItemId: req.params.menuItemId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: reviews });
  } catch (err) { next(err); }
});

// GET /reviews/:outletId — list reviews for an outlet (any authenticated user)
router.get('/:outletId', protect, async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { outletId: req.params.outletId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (err) { next(err); }
});

// POST /reviews — create a review (students only, one per order)
router.post('/', protect, authorizeRole(ROLES.STUDENT), async (req, res, next) => {
  try {
    const { outletId, orderId, rating, comment, itemReviews } = req.body;
    if (!outletId || !orderId || !rating) {
      return res.status(400).json({ success: false, message: 'outletId, orderId, and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
    }
    // Verify the order belongs to the student + is COMPLETED
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.studentId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your order' });
    }
    if (order.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Can only review completed orders' });
    }
    const review = await prisma.review.upsert({
      where: { orderId },
      create: { userId: req.user.id, outletId, orderId, rating, comment: comment || '' },
      update: { rating, comment: comment || '' },
    });

    // Food-wise reviews — optional per-item ratings for the order's items.
    // One per (order, menuItem); upsert so re-submitting the same review
    // updates instead of failing on the unique constraint.
    let savedItemReviews = [];
    if (Array.isArray(itemReviews) && itemReviews.length > 0) {
      const allowed = new Set(order.items.map((i) => i.menuItemId));
      const valid = itemReviews.filter(
        (r) => allowed.has(r.menuItemId) && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5
      );
      savedItemReviews = await Promise.all(
        valid.map((r) =>
          prisma.menuItemReview.upsert({
            where: { orderId_menuItemId: { orderId, menuItemId: r.menuItemId } },
            create: {
              userId: req.user.id, outletId, orderId,
              menuItemId: r.menuItemId, rating: r.rating, comment: r.comment || '',
            },
            update: { rating: r.rating, comment: r.comment || '' },
          })
        )
      );
      // Food rating aggregates ride on the cached menu response — bust it.
      await cacheDel(`catalog:menu:${outletId}`);
    }

    res.status(201).json({ success: true, data: { review, itemReviews: savedItemReviews } });
  } catch (err) { next(err); }
});

module.exports = router;
