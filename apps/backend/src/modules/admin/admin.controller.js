const adminService = require('./admin.service');
const { audit } = require('../../lib/audit');

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

const getOverview = wrap(async (req, res) => {
  const overview = await adminService.getOverview();
  res.status(200).json({ success: true, data: overview });
});

const getUsers = wrap(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await adminService.getUsers({
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 50,
  });
  res.status(200).json({ success: true, data: result });
});

const getUser = wrap(async (req, res) => {
  const user = await adminService.getUser(req.params.userId);
  res.status(200).json({ success: true, data: user });
});

const updateUserStatus = wrap(async (req, res) => {
  const { user, before } = await adminService.updateUserStatus(
    req.params.userId, req.body.status, req.user.id
  );
  await audit({
    actorId: req.user.id,
    action: 'USER_STATUS_CHANGED',
    targetType: 'User',
    targetId: user.id,
    before,
    after: { status: user.status },
    req,
  });
  res.status(200).json({ success: true, data: user });
});

const getOutlets = wrap(async (req, res) => {
  const outlets = await adminService.getOutlets();
  res.status(200).json({ success: true, data: outlets });
});

const getOutlet = wrap(async (req, res) => {
  const outlet = await adminService.getOutlet(req.params.outletId);
  res.status(200).json({ success: true, data: outlet });
});

const createOutlet = wrap(async (req, res) => {
  const outlet = await adminService.createOutlet(req.body);
  await audit({
    actorId: req.user.id,
    action: 'OUTLET_CREATED',
    targetType: 'Outlet',
    targetId: outlet.id,
    after: { name: outlet.name, status: outlet.status },
    req,
  });
  res.status(201).json({ success: true, data: outlet });
});

const getAllStaff = wrap(async (req, res) => {
  const staff = await adminService.getAllStaff();
  res.status(200).json({ success: true, data: staff });
});

const updateOutletStatus = wrap(async (req, res) => {
  const { outlet, before } = await adminService.updateOutletStatus(req.params.outletId, req.body.status);
  await audit({
    actorId: req.user.id,
    action: 'OUTLET_STATUS_CHANGED',
    targetType: 'Outlet',
    targetId: outlet.id,
    before,
    after: { status: outlet.status },
    req,
  });
  res.status(200).json({ success: true, data: outlet });
});

const getOrders = wrap(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await adminService.getOrders({
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 100,
  });
  res.status(200).json({ success: true, data: result });
});

const getOrder = wrap(async (req, res) => {
  const order = await adminService.getOrder(req.params.orderId);
  res.status(200).json({ success: true, data: order });
});

const getMenu = wrap(async (req, res) => {
  const menu = await adminService.getMenu();
  res.status(200).json({ success: true, data: menu });
});

const getMenuItem = wrap(async (req, res) => {
  const item = await adminService.getMenuItem(req.params.itemId);
  res.status(200).json({ success: true, data: item });
});

const updateMenuItemStatus = wrap(async (req, res) => {
  const { item, before } = await adminService.updateMenuItemStatus(req.params.itemId, req.body.isAvailable);
  await audit({
    actorId: req.user.id,
    action: 'MENU_AVAILABILITY_CHANGED',
    targetType: 'MenuItem',
    targetId: item.id,
    before,
    after: { isAvailable: item.isAvailable },
    req,
  });
  res.status(200).json({ success: true, data: item });
});

// INO-P0-7 / INO-P0-9: manual super-admin refund endpoint.
// Body (refundCreateSchema): { orderId, amount, reason, trigger }
// We accept the schema for shape compatibility but ignore client-supplied
// `trigger` — the service always sets triggeredBy = SUPER_ADMIN_MANUAL so
// a compromised super-admin token can't masquerade as an OUTLET_CANCEL.
const issueManualRefund = wrap(async (req, res) => {
  const { orderId, amount, reason } = req.body;
  const result = await adminService.issueManualRefund(orderId, { amount, reason }, req.user.id);
  await audit({
    actorId: req.user.id,
    action: result.retried ? 'ADMIN_REFUND_RETRY' : 'ADMIN_REFUND_ISSUED',
    targetType: 'Refund',
    targetId: result.refund.id,
    after: { amount: result.refund.amount, retried: result.retried },
    req,
  });
  res.status(200).json({ success: true, data: result.refund });
});

module.exports = {
  getOverview, getUsers, getUser, updateUserStatus,
  getOutlets, getOutlet, createOutlet, getAllStaff, updateOutletStatus,
  getOrders, getOrder, getMenu, getMenuItem, updateMenuItemStatus,
  issueManualRefund,
};
