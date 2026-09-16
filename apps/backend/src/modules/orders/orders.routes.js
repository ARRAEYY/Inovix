const express = require('express');
const { protect } = require('../../middleware/auth.middleware.js');
const ordersController = require('./orders.controller.js');

const router = express.Router();

router.use(protect); // All order routes require authentication

router.post('/', ordersController.createOrder);
router.get('/', ordersController.getUserOrders);
router.get('/:orderId', ordersController.getOrderById);

module.exports = router;
