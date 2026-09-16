const express = require('express');
const { getOutletOrders, getOutletOrder, updateOrderStatus } = require('./orders.controller');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const { OUTLET_ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const { updateOrderStatusSchema } = require('../../../../../packages/validation/src/index');

const router = express.Router();

// Both OUTLET_STAFF and OUTLET_ADMIN can view and process orders
router.use(protect, authorizeRole(...OUTLET_ROLES));

router.get('/', getOutletOrders);
router.get('/:orderId', getOutletOrder);
router.patch('/:orderId/status', validateBody(updateOrderStatusSchema), updateOrderStatus);

module.exports = router;
