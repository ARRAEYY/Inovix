const adminService = require('./admin.service');

const getOverview = async (req, res, next) => {
  try {
    const overview = await adminService.getOverview();
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await adminService.getUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await adminService.getUser(req.params.userId);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const user = await adminService.updateUserStatus(req.params.userId, req.body.status, req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

const getOutlets = async (req, res, next) => {
  try {
    const outlets = await adminService.getOutlets();
    res.status(200).json({ success: true, data: outlets });
  } catch (error) {
    next(error);
  }
};

const createOutlet = async (req, res, next) => {
  try {
    const outlet = await adminService.createOutlet(req.body);
    res.status(201).json({ success: true, data: outlet });
  } catch (error) {
    next(error);
  }
};

const getOutlet = async (req, res, next) => {
  try {
    const outlet = await adminService.getOutlet(req.params.outletId);
    res.status(200).json({ success: true, data: outlet });
  } catch (error) {
    next(error);
  }
};

const updateOutletStatus = async (req, res, next) => {
  try {
    const outlet = await adminService.updateOutletStatus(req.params.outletId, req.body.status);
    res.status(200).json({ success: true, data: outlet });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const orders = await adminService.getOrders();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await adminService.getOrder(req.params.orderId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getMenu = async (req, res, next) => {
  try {
    const menu = await adminService.getMenu();
    res.status(200).json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
};

const getMenuItem = async (req, res, next) => {
  try {
    const item = await adminService.getMenuItem(req.params.itemId);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const updateMenuItemStatus = async (req, res, next) => {
  try {
    const item = await adminService.updateMenuItemStatus(req.params.itemId, req.body.isAvailable);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getUsers,
  getUser,
  updateUserStatus,
  getOutlets,
  createOutlet,
  getOutlet,
  updateOutletStatus,
  getOrders,
  getOrder,
  getMenu,
  getMenuItem,
  updateMenuItemStatus
};
