const express = require('express');
const { protect } = require('../../middleware/auth.middleware');
const { validateQuery } = require('../../middleware/validation.middleware');
const { z } = require('zod');
const notificationsController = require('./notifications.controller');

const router = express.Router();

router.use(protect);

router.get('/', validateQuery(z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  unread: z.enum(['true', 'false']).optional(),
})), notificationsController.list);

router.post('/read/all', notificationsController.markAllRead);
router.post('/read/:notificationId', notificationsController.markRead);

module.exports = router;
