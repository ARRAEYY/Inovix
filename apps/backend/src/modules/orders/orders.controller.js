const ordersService = require('./orders.service.js');

const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const order = await ordersService.createOrder(userId, req.body);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

async function getUserOrders(req, res, next) {
  try {
    const userId = req.user.id;
    const orders = await ordersService.getUserOrders(userId);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const order = await ordersService.getOrderById(userId, orderId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

async function getOutletOrders(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const orders = await ordersService.getOutletOrders(outletId);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

async function getOutletOrder(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const { orderId } = req.params;
    const order = await ordersService.getOutletOrder(outletId, orderId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      throw { status: 400, message: 'status is required' };
    }

    const order = await ordersService.updateOrderStatus(outletId, orderId, status);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  getOutletOrders,
  getOutletOrder,
  updateOrderStatus
};
