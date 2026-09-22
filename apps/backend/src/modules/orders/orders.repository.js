const { orders: mockOrders } = require('../../data/mockData.js');

let currentOrders = [...mockOrders];

const createOrder = async (orderData) => {
  const newOrder = {
    ...orderData,
    id: `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Save to in-memory array
  currentOrders.unshift(newOrder);
  return newOrder;
};

const findByUserId = async (userId) => {
  return currentOrders.filter(order => order.userId === userId);
};

const findAll = async () => {
  return [...currentOrders];
};

const findById = async (id) => {
  return currentOrders.find(order => order.id === id) || null;
};

const findByOutletId = async (outletId) => {
  return currentOrders.filter(order => order.outletId === outletId);
};

const updateStatus = async (orderId, status, additionalData = {}) => {
  const orderIndex = currentOrders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return null;

  currentOrders[orderIndex] = {
    ...currentOrders[orderIndex],
    ...additionalData,
    status,
    updatedAt: new Date().toISOString()
  };

  return currentOrders[orderIndex];
};

module.exports = {
  createOrder,
  findAll,
  findByUserId,
  findById,
  findByOutletId,
  updateStatus
};
