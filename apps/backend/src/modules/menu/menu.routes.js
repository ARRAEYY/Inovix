const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const menuController = require('./menu.controller');

const router = express.Router();

router.use(protect, authorizeRole('OUTLET'));

router.get('/', menuController.getOutletMenu);
router.get('/:itemId', menuController.getMenuItem);
router.post('/', menuController.createMenuItem);
router.patch('/:itemId', menuController.updateMenuItem);
router.delete('/:itemId', menuController.deleteMenuItem);

module.exports = router;
