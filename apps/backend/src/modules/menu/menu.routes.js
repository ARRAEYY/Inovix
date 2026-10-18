const express = require('express');
const { protect, authorizeRole, requireOutletScope } = require('../../middleware/auth.middleware');
const menuController = require('./menu.controller');
const { OUTLET_ROLES, OUTLET_ADMIN_ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const { menuItemCreateSchema, menuItemUpdateSchema, updateMenuAvailabilitySchema } = require('@nosh/validation');
const { cacheDel, cacheDelPrefix } = require('../../lib/cache');
const prisma = require('../../lib/prisma');

const router = express.Router();

// Helper to invalidate catalog cache for this outlet
const invalidateOutletCache = async (outletId) => {
  if (!outletId) return;
  try {
    await cacheDel(`catalog:categories:${outletId}`);
    await cacheDel(`catalog:menu:${outletId}`);
    await cacheDelPrefix(`catalog:categories:${outletId}`);
    await cacheDelPrefix(`catalog:menu:${outletId}`);
  } catch (e) {
    console.error('Failed to invalidate outlet cache', e);
  }
};

// ─── Menu category CRUD (Must be mounted BEFORE /:itemId) ─────────────────
router.get('/categories', protect, authorizeRole(...OUTLET_ROLES), requireOutletScope, async (req, res, next) => {
  try {
    const cats = await prisma.menuCategory.findMany({
      where: { outletId: req.user.outletId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    });
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
});

router.post('/categories', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, async (req, res, next) => {
  try {
    const { name, sortOrder, imageUrl } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Category name is required' });
    const cat = await prisma.menuCategory.create({
      data: {
        outletId: req.user.outletId,
        name: name.trim(),
        sortOrder: sortOrder || 0,
        imageUrl: imageUrl ? imageUrl.trim() : null,
      },
    });
    await invalidateOutletCache(req.user.outletId);
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Category already exists' });
    next(err);
  }
});

router.patch('/categories/:categoryId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    const existing = await prisma.menuCategory.findFirst({
      where: { id: categoryId, outletId: req.user.outletId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found in this outlet' });
    }

    const { name, sortOrder, imageUrl } = req.body;
    const cat = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ? imageUrl.trim() : null } : {}),
      },
    });
    await invalidateOutletCache(req.user.outletId);
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

router.delete('/categories/:categoryId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    const existing = await prisma.menuCategory.findFirst({
      where: { id: categoryId, outletId: req.user.outletId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found in this outlet' });
    }

    // Unassign items from this category before deleting
    await prisma.menuItem.updateMany({
      where: { categoryId: categoryId, outletId: req.user.outletId },
      data: { categoryId: null },
    });
    await prisma.menuCategory.delete({ where: { id: categoryId } });
    await invalidateOutletCache(req.user.outletId);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
});

// ─── Menu item routes ─────────────────────────────────────────────────────
// Menu viewing: both OUTLET_STAFF and OUTLET_ADMIN
router.get('/', protect, authorizeRole(...OUTLET_ROLES), requireOutletScope, menuController.getOutletMenu);

// Availability toggle: both OUTLET_STAFF and OUTLET_ADMIN (86 an item).
// Mounted BEFORE /:itemId so PATCH /:itemId (admin-only) doesn't capture it.
router.patch('/:itemId/availability', protect, authorizeRole(...OUTLET_ROLES), requireOutletScope, validateBody(updateMenuAvailabilitySchema), menuController.updateAvailability);

// Menu management (create/update/delete): OUTLET_ADMIN only
router.post('/', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, validateBody(menuItemCreateSchema), menuController.createMenuItem);
router.patch('/:itemId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, validateBody(menuItemUpdateSchema), menuController.updateMenuItem);
router.delete('/:itemId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, menuController.deleteMenuItem);
router.get('/:itemId', protect, authorizeRole(...OUTLET_ROLES), requireOutletScope, menuController.getMenuItem);

module.exports = router;
