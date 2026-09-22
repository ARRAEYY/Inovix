const ordersRepo = require('./orders.repository.js');
const menuRepo = require('../menu/menu.repository.js');
const { outlets } = require('../../data/mockData.js');

const ORDER_STATUS = {
  PLACED: "PLACED",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  DECLINED: "DECLINED"
};

const generateOrderNumber = () => {
  return `NOSH-${Math.floor(1000 + Math.random() * 9000)}`;
};

const createOrder = async (userId, payload) => {
  const { outletId, items, paymentMethod, notes } = payload;

  if (!outletId) throw { status: 400, message: 'outletId is required' };
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: 'items array is required and cannot be empty' };
  }
  if (!paymentMethod) throw { status: 400, message: 'paymentMethod is required' };

  // Validate outlet
  const outlet = outlets.find(o => o.id === outletId);
  if (!outlet) throw { status: 404, message: 'Outlet not found' };
  if (outlet.status === 'CLOSED') throw { status: 400, message: 'Outlet is closed' };

  let subtotal = 0;
  const processedItems = [];

  for (const itemReq of items) {
    if (!itemReq.menuItemId) throw { status: 400, message: 'menuItemId is required for all items' };
    if (!itemReq.quantity || !Number.isInteger(itemReq.quantity) || itemReq.quantity <= 0) {
      throw { status: 400, message: 'Quantity must be a positive integer' };
    }

    const menuItem = await menuRepo.findById(itemReq.menuItemId);
    if (!menuItem) throw { status: 404, message: `Menu item ${itemReq.menuItemId} not found` };
    if (menuItem.outletId !== outletId) {
      throw { status: 400, message: `Menu item ${itemReq.menuItemId} does not belong to outlet ${outletId}` };
    }
    if (!menuItem.isAvailable) {
      throw { status: 400, message: `Menu item ${menuItem.name} is currently unavailable` };
    }

    const itemTotal = menuItem.price * itemReq.quantity;
    subtotal += itemTotal;

    processedItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: itemReq.quantity,
      image: menuItem.image,
      itemTotal
    });
  }

  // Simplified discount logic for now
  const discount = 0;
  const total = subtotal - discount;

  const newOrder = {
    orderNumber: generateOrderNumber(),
    userId,
    outletId,
    outletSnapshot: {
      id: outlet.id,
      name: outlet.name
    },
    items: processedItems,
    subtotal,
    discount,
    total,
    paymentMethod,
    paymentStatus: 'PAID', // Mock payment abstraction
    status: ORDER_STATUS.PLACED,
    notes: notes || ''
  };

  return await ordersRepo.createOrder(newOrder);
};

const getUserOrders = async (userId) => {
  return await ordersRepo.findByUserId(userId);
};

const getOrderById = async (userId, orderId) => {
  const order = await ordersRepo.findById(orderId);
  if (!order) {
    throw { status: 404, message: 'Order not found' };
  }
  
  if (order.userId !== userId) {
    throw { status: 403, message: 'You are not authorized to view this order' };
  }
  
  return order;
};

const getOutletOrders = async (outletId) => {
  return await ordersRepo.findByOutletId(outletId);
};

const getOutletOrder = async (outletId, orderId) => {
  const order = await ordersRepo.findById(orderId);
  if (!order) {
    throw { status: 404, message: 'Order not found' };
  }

  if (order.outletId !== outletId) {
    throw { status: 403, message: 'You are not authorized to view this order' };
  }

  return order;
};

const ALLOWED_TRANSITIONS = {
  PLACED: ['PREPARING', 'CANCELLED', 'DECLINED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  DECLINED: []
};

const updateOrderStatus = async (outletId, orderId, status, additionalData = {}) => {
  const order = await ordersRepo.findById(orderId);
  if (!order) {
    throw { status: 404, message: 'Order not found' };
  }

  if (order.outletId !== outletId) {
    throw { status: 403, message: 'You are not authorized to modify this order' };
  }

  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw { status: 400, message: 'Invalid status' };
  }

  const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(status)) {
    throw { status: 400, message: `Cannot transition from ${order.status} to ${status}` };
  }

  if (status === ORDER_STATUS.DECLINED) {
    if (!additionalData.rejectionReason) {
      throw { status: 400, message: 'rejectionReason is required when declining an order' };
    }
  }

  return await ordersRepo.updateStatus(orderId, status, additionalData);
};

module.exports = {
  ORDER_STATUS,
  createOrder,
  getUserOrders,
  getOrderById,
  getOutletOrders,
  getOutletOrder,
  updateOrderStatus
};
