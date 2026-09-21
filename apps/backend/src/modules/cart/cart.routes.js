const express = require('express');
const { protect } = require('../../middleware/auth.middleware');
const { authorizeRole } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const { cartItemAddSchema, cartItemUpdateSchema } = require('@nosh/validation');
const { z } = require('zod');
const cartController = require('./cart.controller');

const router = express.Router();

router.use(protect, authorizeRole(ROLES.STUDENT));

// Active cart
router.get('/', cartController.getActiveCart);
router.get('/totals', cartController.getTotals);
router.delete('/', cartController.clearCart);

// Per-outlet cart (create or get)
router.get('/outlets/:outletId', cartController.getCart);

// Cart item operations
router.post('/outlets/:outletId/items', validateBody(cartItemAddSchema), cartController.addItem);
router.patch('/items/:cartItemId', validateBody(cartItemUpdateSchema), cartController.updateItem);
router.delete('/items/:cartItemId', cartController.removeItem);

module.exports = router;
