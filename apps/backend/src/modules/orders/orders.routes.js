const express = require('express');
const { protect } = require('../../middleware/auth.middleware.js');
const { validateBody } = require('../../middleware/validation.middleware');
const ordersController = require('./orders.controller.js');
const { createOrderSchema, updateOrderStatusSchema } = require('../../../../../packages/validation/src/index');

const router = express.Router();

router.use(protect); // All order routes require authentication

router.post('/', validateBody(createOrderSchema), ordersController.createOrder);
router.get('/', ordersController.getUserOrders);
router.get('/:orderId', ordersController.getOrderById);

module.exports = router;
