const express = require('express');
const { getOutletOrders, getOutletOrder, updateOrderStatus } = require('./orders.controller');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');

const router = express.Router();

// All outlet routes require OUTLET role
router.use(protect, authorizeRole('OUTLET'));

router.get('/', getOutletOrders);
router.get('/:orderId', getOutletOrder);
router.patch('/:orderId/status', updateOrderStatus);

module.exports = router;
