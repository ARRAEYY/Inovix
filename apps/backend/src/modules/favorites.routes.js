const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { ROLES } = require('../lib/constants');
const { authorizeRole } = require('../middleware/auth.middleware');
const prisma = require('../lib/prisma');

const router = express.Router();
router.use(protect, authorizeRole(ROLES.STUDENT));

// GET /favorites — list the student's favorite outlets
router.get('/', async (req, res, next) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: { outlet: { select: { id: true, name: true, description: true, logoUrl: true, status: true, rating: true, estimatedTime: true, location: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: favorites });
  } catch (err) { next(err); }
});

// POST /favorites/:outletId — add an outlet to favorites
router.post('/:outletId', async (req, res, next) => {
  try {
    const fav = await prisma.favorite.upsert({
      where: { userId_outletId: { userId: req.user.id, outletId: req.params.outletId } },
      create: { userId: req.user.id, outletId: req.params.outletId },
      update: {},
    });
    res.status(201).json({ success: true, data: fav });
  } catch (err) {
    if (err.code === 'P2003') return res.status(404).json({ success: false, message: 'Outlet not found' });
    next(err);
  }
});

// DELETE /favorites/:outletId — remove an outlet from favorites
router.delete('/:outletId', async (req, res, next) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user.id, outletId: req.params.outletId },
    });
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (err) { next(err); }
});

module.exports = router;
