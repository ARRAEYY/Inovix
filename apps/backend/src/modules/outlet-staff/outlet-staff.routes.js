const express = require('express');
const { protect, authorizeRole, requireOutletScope } = require('../../middleware/auth.middleware');
const { ROLES, USER_STATUS } = require('../../lib/constants');
const prisma = require('../../lib/prisma');
const bcrypt = require('bcrypt');

const router = express.Router();

// Only OUTLET_ADMIN can manage staff for their outlet
router.use(protect, authorizeRole(ROLES.OUTLET_ADMIN), requireOutletScope);

// ── GET /api/v1/outlet/staff ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const staffRecords = await prisma.outletStaff.findMany({
      where: { outletId: req.user.outletId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
      },
    });

    const items = staffRecords.map((r) => ({
      staffId: r.id,
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      role: r.user.role,
      status: r.user.status,
      createdAt: r.user.createdAt,
      lastLoginAt: r.user.lastLoginAt,
    }));

    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/outlet/staff ───────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role = ROLES.OUTLET_STAFF } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    const initialPassword = password || 'Staff@12345';
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: role === ROLES.OUTLET_ADMIN ? ROLES.OUTLET_ADMIN : ROLES.OUTLET_STAFF,
        status: USER_STATUS.ACTIVE,
        onboardingCompleted: true,
        outletStaff: {
          create: {
            outletId: req.user.outletId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /api/v1/outlet/staff/:staffId/status ──────────────────────────────
router.patch('/:staffId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const { staffId } = req.params;

    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be ACTIVE or SUSPENDED',
      });
    }

    // Verify staff belongs to this outlet
    const mapping = await prisma.outletStaff.findFirst({
      where: {
        OR: [{ id: staffId }, { userId: staffId }],
        outletId: req.user.outletId,
      },
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found in this outlet',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: mapping.userId },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
