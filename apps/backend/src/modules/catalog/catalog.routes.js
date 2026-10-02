/**
 * Catalog routes — student-facing browse endpoints.
 *
 * Spec §3.1 RBAC: "Browse any outlet's menu" — applies to Student, Outlet
 * Staff, Outlet Admin, Super Admin. So all routes here are authenticated but
 * allow any authenticated role. Previously these were public; that was a
 * spec deviation (Layer 1: "every authenticated request carries a JWT").
 *
 * INO-P1-26 / INO-P1-27 fix: catalog visibility rules.
 *   - /outlets           already filtered to OPEN/BUSY only — unchanged.
 *   - /outlets/:id       now returns 404 for CLOSED/SUSPENDED/PENDING.
 *                        Students viewing past orders should use the orders
 *                        endpoint (which carries an outletSnapshot); the
 *                        catalog endpoint is browse-only.
 *   - /outlets/:id/menu  same — reject if the outlet isn't orderable.
 *   - /outlets/:id/categories  same.
 *   - /menu/popular      now filters parent outlet to OPEN/BUSY only (was
 *                        returning popular items from closed outlets).
 *   - /search            now applies the same OPEN/BUSY outlet filter and
 *                        only returns menu items where isAvailable=true
 *                        AND parent outlet is OPEN/BUSY.
 *
 * The visibility set is defined once as VISIBLE_OUTLET_STATUSES so all
 * endpoints stay in sync if the policy ever changes.
 */

const express = require('express');
const { protect } = require('../../middleware/auth.middleware');
const { OUTLET_STATUS, ERROR_CODES } = require('../../lib/constants');
const prisma = require('../../lib/prisma');
const { cached } = require('../../lib/cache');
const menuRepo = require('../menu/menu.repository');

const router = express.Router();

// Catalog reads are cached for 30s (no explicit invalidation — outlet/menu
// edits from the admin side become visible within one TTL window).
const CATALOG_TTL = 30;

// Outlets that are visible in the catalog (browse, search, popular).
// CLOSED / SUSPENDED / PENDING outlets are hidden from students — they
// cannot start new orders from these outlets.
const VISIBLE_OUTLET_STATUSES = [OUTLET_STATUS.OPEN, OUTLET_STATUS.BUSY];

router.use(protect);

// All outlets (list) — already filtered, kept for clarity.
router.get('/outlets', async (req, res, next) => {
  try {
    const outlets = await cached('catalog:outlets', CATALOG_TTL, () =>
      prisma.outlet.findMany({
        where: { status: { in: VISIBLE_OUTLET_STATUSES } },
        orderBy: [{ featured: 'desc' }, { rating: 'desc' }],
      })
    );
    res.json({ success: true, data: outlets });
  } catch (err) {
    next(err);
  }
});

router.get('/outlets/:id', async (req, res, next) => {
  try {
    // Visibility check stays live (a newly closed outlet must 404 fast);
    // only the outlet row itself is cached.
    const outlet = await prisma.outlet.findUnique({ where: { id: req.params.id } });
    if (!outlet || !VISIBLE_OUTLET_STATUSES.includes(outlet.status)) {
      // Treat closed/suspended/pending outlets as "not found" from the
      // student's perspective so we don't leak their existence.
      return res.status(404).json({
        success: false,
        message: 'Outlet not found',
        code: ERROR_CODES.NOT_FOUND,
        errors: [],
      });
    }
    res.json({ success: true, data: outlet });
  } catch (err) {
    next(err);
  }
});

router.get('/outlets/:id/menu', async (req, res, next) => {
  try {
    // Verify the outlet is orderable before exposing its menu.
    const outlet = await prisma.outlet.findUnique({
      where: { id: req.params.id },
      select: { status: true },
    });
    if (!outlet || !VISIBLE_OUTLET_STATUSES.includes(outlet.status)) {
      return res.status(404).json({
        success: false,
        message: 'Outlet not found or not accepting orders',
        code: ERROR_CODES.NOT_FOUND,
        errors: [],
      });
    }
    const menu = await cached(`catalog:menu:${req.params.id}`, CATALOG_TTL, async () => {
      const items = await menuRepo.findAllByOutletId(req.params.id);
      // Food-wise rating aggregates ride on the menu payload (and its
      // caches) so FoodCards can show ★ avg (count) without extra requests.
      const ids = items.map((i) => i.id);
      const agg = ids.length
        ? await prisma.menuItemReview.groupBy({
            by: ['menuItemId'],
            where: { menuItemId: { in: ids } },
            _avg: { rating: true },
            _count: { _all: true },
          })
        : [];
      const byItem = new Map(agg.map((a) => [a.menuItemId, a]));
      return items.map((i) => {
        const a = byItem.get(i.id);
        return {
          ...i,
          foodRating: a
            ? { avg: Math.round((a._avg.rating || 0) * 10) / 10, count: a._count._all }
            : null,
        };
      });
    });
    res.json({ success: true, data: menu });
  } catch (err) {
    next(err);
  }
});

router.get('/outlets/:id/categories', async (req, res, next) => {
  try {
    const outlet = await prisma.outlet.findUnique({
      where: { id: req.params.id },
      select: { status: true },
    });
    if (!outlet || !VISIBLE_OUTLET_STATUSES.includes(outlet.status)) {
      return res.status(404).json({
        success: false,
        message: 'Outlet not found or not accepting orders',
        code: ERROR_CODES.NOT_FOUND,
        errors: [],
      });
    }
    const categories = await cached(`catalog:categories:${req.params.id}`, CATALOG_TTL, () =>
      prisma.menuCategory.findMany({
        where: { outletId: req.params.id },
        orderBy: { sortOrder: 'asc' },
      })
    );
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

router.get('/menu/popular', async (req, res, next) => {
  try {
    // INO-P1-26 fix: previously this returned popular items from ALL
    // outlets including CLOSED/SUSPENDED ones. Now we filter the parent
    // outlet to OPEN/BUSY.
    const popular = await cached('catalog:popular', CATALOG_TTL, () =>
      prisma.menuItem.findMany({
        where: {
          popular: true,
          isAvailable: true,
          outlet: { status: { in: VISIBLE_OUTLET_STATUSES } },
        },
        include: { outlet: { select: { id: true, name: true, slug: true } } },
      })
    );
    res.json({ success: true, data: popular });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const query = (req.query.q || '').toLowerCase().trim();
    if (!query) return res.json({ success: true, data: { outlets: [], menuItems: [] } });

    // INO-P1-26 fix: search now applies the same visibility rules as the
    // listing — only OPEN/BUSY outlets, and only available menu items
    // whose parent outlet is OPEN/BUSY. Previously search returned
    // closed/suspended outlets and unavailable items.
    const [outlets, items] = await Promise.all([
      prisma.outlet.findMany({
        where: {
          status: { in: VISIBLE_OUTLET_STATUSES },
          OR: [
            { name: { contains: query } },
            { tags: { contains: query } },
            { description: { contains: query } },
          ],
        },
      }),
      prisma.menuItem.findMany({
        where: {
          isAvailable: true,
          outlet: { status: { in: VISIBLE_OUTLET_STATUSES } },
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
        },
        include: { outlet: { select: { id: true, name: true, status: true } } },
      }),
    ]);

    res.json({ success: true, data: { outlets, menuItems: items } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
