const express = require('express');
const { protect, authorizeRole, requireOutletScope } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validation.middleware');
const { getOutletOrders, getOutletOrder, getOutletKPIs, updateOrderStatus } = require('./orders.controller');
const { OUTLET_ROLES } = require('../../lib/constants');
const { updateOrderStatusSchema } = require('@nosh/validation');
const { z } = require('zod');

const router = express.Router();

// Both OUTLET_STAFF and OUTLET_ADMIN can view + process orders
router.use(protect, authorizeRole(...OUTLET_ROLES), requireOutletScope);

router.get('/', validateQuery(z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  status: z.string().optional(),
})), getOutletOrders);

// INO-P1-32: dedicated KPIs endpoint — mounted BEFORE /:orderId so the
// path doesn't get captured as an orderId param.
router.get('/kpis', getOutletKPIs);

router.get('/:orderId', getOutletOrder);
router.patch('/:orderId/status', validateBody(updateOrderStatusSchema), updateOrderStatus);

module.exports = router;
