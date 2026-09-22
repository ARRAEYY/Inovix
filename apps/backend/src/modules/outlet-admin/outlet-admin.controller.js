const outletAdminService = require('./outlet-admin.service');

// ── Dashboard ─────────────────────────────────────────────────────────────────

const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await outletAdminService.getDashboardStats(req.user.outletId);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

// ── Orders ────────────────────────────────────────────────────────────────────

const getOrders = async (req, res, next) => {
  try {
    const orders = await outletAdminService.getOrders(req.user.outletId);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

// ── Menu ──────────────────────────────────────────────────────────────────────

const getMenu = async (req, res, next) => {
  try {
    const menu = await outletAdminService.getMenu(req.user.outletId);
    res.status(200).json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
};

const createMenuItem = async (req, res, next) => {
  try {
    const item = await outletAdminService.createMenuItem(req.user.outletId, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const updateMenuItem = async (req, res, next) => {
  try {
    const item = await outletAdminService.updateMenuItem(req.user.outletId, req.params.itemId, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const deleteMenuItem = async (req, res, next) => {
  try {
    await outletAdminService.deleteMenuItem(req.user.outletId, req.params.itemId);
    res.status(200).json({ success: true, message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
};

const updateMenuAvailability = async (req, res, next) => {
  try {
    const item = await outletAdminService.updateMenuAvailability(req.user.outletId, req.params.itemId, req.body.isAvailable);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

// ── Staff ─────────────────────────────────────────────────────────────────────

const getStaff = async (req, res, next) => {
  try {
    const staff = await outletAdminService.getStaff(req.user.outletId);
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
};

const createStaff = async (req, res, next) => {
  try {
    const staff = await outletAdminService.createStaff(req.user.outletId, req.body);
    res.status(201).json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
};

const getStaffMember = async (req, res, next) => {
  try {
    const staff = await outletAdminService.getStaffMember(req.user.outletId, req.params.staffId);
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
};

const updateStaffStatus = async (req, res, next) => {
  try {
    const staff = await outletAdminService.updateStaffStatus(req.user.outletId, req.params.staffId, req.body.status);
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getOrders,
  getMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  updateMenuAvailability,
  getStaff,
  createStaff,
  getStaffMember,
  updateStaffStatus
};
