/**
 * Catalog routes — student-facing browse endpoints.
 *
 * Spec §3.1 RBAC: "Browse any outlet's menu" — applies to Student, Outlet
 * Staff, Outlet Admin, Super Admin. So all routes here are authenticated but
 * allow any authenticated role. Previously these were public; that was a
 * spec deviation (Layer 1: "every authenticated request carries a JWT").
 */

const express = require('express');
const { protect } = require('../../middleware/auth.middleware');
const prisma = require('../../lib/prisma');
const menuRepo = require('../menu/menu.repository');

const router = express.Router();

router.use(protect);

// All outlets (list)
router.get('/outlets', async (req, res, next) => {
  try {
    const outlets = await prisma.outlet.findMany({
      where: { status: { in: ['OPEN', 'BUSY'] } },
      orderBy: [{ featured: 'desc' }, { rating: 'desc' }],
    });
    res.json({ success: true, data: outlets });
  } catch (err) {
    next(err);
  }
});

router.get('/outlets/:id', async (req, res, next) => {
  try {
    const outlet = await prisma.outlet.findUnique({ where: { id: req.params.id } });
    if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });
    res.json({ success: true, data: outlet });
  } catch (err) {
    next(err);
  }
});

router.get('/outlets/:id/menu', async (req, res, next) => {
  try {
    const menu = await menuRepo.findAllByOutletId(req.params.id);
    res.json({ success: true, data: menu });
  } catch (err) {
    next(err);
  }
});

router.get('/outlets/:id/categories', async (req, res, next) => {
  try {
    const categories = await prisma.menuCategory.findMany({
      where: { outletId: req.params.id },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

router.get('/menu/popular', async (req, res, next) => {
  try {
    const popular = await prisma.menuItem.findMany({
      where: { popular: true, isAvailable: true },
      include: { outlet: { select: { id: true, name: true, slug: true } } },
    });
    res.json({ success: true, data: popular });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const query = (req.query.q || '').toLowerCase().trim();
    if (!query) return res.json({ success: true, data: { outlets: [], menuItems: [] } });

    const [outlets, items] = await Promise.all([
      prisma.outlet.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { tags: { contains: query } },
            { description: { contains: query } },
          ],
        },
      }),
      prisma.menuItem.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
        },
        include: { outlet: { select: { id: true, name: true } } },
      }),
    ]);

    res.json({ success: true, data: { outlets, menuItems: items } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
