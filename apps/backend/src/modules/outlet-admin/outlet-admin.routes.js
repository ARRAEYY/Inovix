const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const outletAdminController = require('./outlet-admin.controller');
const { validateBody } = require('../../middleware/validation.middleware');
const { menuItemCreateSchema, menuItemUpdateSchema, staffCreateSchema, staffStatusSchema } = require('../../../../../packages/validation/src/index');

const router = express.Router();

// All routes here must be protected and restricted to OUTLET_ADMIN
router.use(protect, authorizeRole('OUTLET_ADMIN'));

// ── Dashboard Statistics ──────────────────────────────────────────────────────
router.get('/dashboard', outletAdminController.getDashboardStats);

// ── Orders ────────────────────────────────────────────────────────────────────
router.get('/orders', outletAdminController.getOrders);

// ── Menu Management ───────────────────────────────────────────────────────────
router.get('/menu', outletAdminController.getMenu);
router.post('/menu', validateBody(menuItemCreateSchema), outletAdminController.createMenuItem);
router.patch('/menu/:itemId', validateBody(menuItemUpdateSchema), outletAdminController.updateMenuItem);
router.delete('/menu/:itemId', outletAdminController.deleteMenuItem);
router.patch('/menu/:itemId/availability', outletAdminController.updateMenuAvailability);

// ── Staff Management ──────────────────────────────────────────────────────────

// Schemas imported from validation package

router.get('/staff', outletAdminController.getStaff);
router.post('/staff', validateBody(staffCreateSchema), outletAdminController.createStaff);
router.get('/staff/:staffId', outletAdminController.getStaffMember);
router.patch('/staff/:staffId/status', validateBody(staffStatusSchema), outletAdminController.updateStaffStatus);

module.exports = router;
