const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validation.middleware');
const ordersController = require('./orders.controller');
const { createOrderSchema, updateOrderStatusSchema } = require('@nosh/validation');
const { ROLES } = require('../../lib/constants');
const { z } = require('zod');

const router = express.Router();

// INO-AUDIT4-D3 fix: /api/v1/orders routes are student-facing. The
// previous implementation had only `protect` (any authenticated user),
// so OUTLET_STAFF / OUTLET_ADMIN / SUPER_ADMIN could POST /orders and
// become the studentId on the order — bypassing the intended role
// boundary. The outlet-side order routes are at /api/v1/outlet/orders
// (separate router with OUTLET_STAFF/ADMIN auth). Now student-only.
router.use(protect, authorizeRole(ROLES.STUDENT));

router.post('/', validateBody(createOrderSchema), ordersController.createOrder);
router.get('/', validateQuery(z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
})), ordersController.getUserOrders);
router.get('/:orderId', ordersController.getOrderById);
router.post('/:orderId/cancel', ordersController.cancelOrder);

module.exports = router;
