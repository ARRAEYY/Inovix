const notificationsService = require('./notifications.service');

async function list(req, res, next) {
  try {
    const { page, pageSize, unread } = req.query;
    const result = await notificationsService.listForUser(req.user.id, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      unreadOnly: unread === 'true',
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const result = await notificationsService.markRead(req.user.id, req.params.notificationId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    const count = await notificationsService.markAllRead(req.user.id);
    res.status(200).json({ success: true, data: { marked: count } });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, markRead, markAllRead };
