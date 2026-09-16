const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const menuController = require('./menu.controller');
const { OUTLET_ROLES, OUTLET_ADMIN_ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const { menuItemCreateSchema, menuItemUpdateSchema } = require('../../../../../packages/validation/src/index');

const router = express.Router();

// Menu viewing: both OUTLET_STAFF and OUTLET_ADMIN
router.get('/', protect, authorizeRole(...OUTLET_ROLES), menuController.getOutletMenu);
router.get('/:itemId', protect, authorizeRole(...OUTLET_ROLES), menuController.getMenuItem);

// Menu management (create/update/delete): OUTLET_ADMIN only
router.post('/', protect, authorizeRole(...OUTLET_ADMIN_ROLES), validateBody(menuItemCreateSchema), menuController.createMenuItem);
router.patch('/:itemId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), validateBody(menuItemUpdateSchema), menuController.updateMenuItem);
router.delete('/:itemId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), menuController.deleteMenuItem);

module.exports = router;
