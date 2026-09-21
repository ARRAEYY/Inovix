/**
 * Orders service — business logic for create + status transitions.
 *
 * Spec ref: §8.6 order state machine + refund rules.
 *
 * Refund implications on transitions (handled by the payments module,
 * which listens to status changes; this service just emits events):
 *   - PENDING → REJECTED: full refund
 *   - PENDING/ACCEPTED/PREPARING → CANCELLED: full refund
 *   - READY → CANCELLED: NO refund (no-show)
 */

const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const ordersRepo = require('./orders.repository');
const menuRepo = require('../menu/menu.repository');
const { validateAndComputeOptionsDelta } = require('../menu/customization');
const { ORDER_STATUS, ALLOWED_TRANSITIONS, ERROR_CODES } = require('../../lib/constants');

const PLATFORM_FEE = 5;
const ORDER_STATUS_PREFIX = 'NOSH-';

function generateOrderNumber() {
  // Spec format: NOSH-NNNN. Sequential would require a counter table; we use
  // a 6-digit random suffix for V1 (collisions extremely unlikely at low volume).
  return `${ORDER_STATUS_PREFIX}${Date.now().toString().slice(-6)}${crypto.randomInt(100, 999)}`;
}

function generatePickupCode() {
  // 6 alphanumeric chars, easy to read out at the counter
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function createOrder(studentId, payload) {
  const { outletId, items, paymentMethod, notes, scheduledFor } = payload;

  if (!outletId) throw { statusCode: 400, message: 'outletId is required' };
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { statusCode: 400, message: 'items array is required and cannot be empty' };
  }
  if (!paymentMethod) throw { statusCode: 400, message: 'paymentMethod is required' };

  // Validate outlet
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw { statusCode: 404, message: 'Outlet not found' };
  if (outlet.status === 'CLOSED' || outlet.status === 'SUSPENDED') {
    throw { statusCode: 400, code: ERROR_CODES.OUTLET_CLOSED, message: 'Outlet is not accepting orders right now' };
  }

  let subtotal = 0;
  const processedItems = [];

  for (const itemReq of items) {
    if (!itemReq.menuItemId) throw { statusCode: 400, message: 'menuItemId is required for all items' };
    if (!itemReq.quantity || !Number.isInteger(itemReq.quantity) || itemReq.quantity <= 0) {
      throw { statusCode: 400, message: 'Quantity must be a positive integer' };
    }

    const menuItem = await menuRepo.findById(itemReq.menuItemId);
    if (!menuItem) throw { statusCode: 404, message: `Menu item ${itemReq.menuItemId} not found` };
    if (menuItem.outletId !== outletId) {
      throw { statusCode: 400, message: `Menu item ${menuItem.name} does not belong to outlet ${outlet.name}` };
    }
    if (!menuItem.isAvailable) {
      throw { statusCode: 400, code: ERROR_CODES.ITEM_UNAVAILABLE, message: `Menu item ${menuItem.name} is currently unavailable` };
    }

    // INO-P0-5 fix: validate selectedOptions against the menu item's
    // customization groups + options (option must belong to a group on
    // this menu item; group minSelect/maxSelect enforced; duplicates
    // rejected). Also compute the price delta so the actual charge
    // reflects customizations. Previously `itemTotal` was
    // `menuItem.price * quantity` — extra cheese at +₹30 was free.
    const optionsDelta = validateAndComputeOptionsDelta(menuItem, itemReq.selectedOptions);
    const unitPrice = Number(menuItem.price) + optionsDelta;
    const itemTotal = unitPrice * itemReq.quantity;
    subtotal += itemTotal;

    processedItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: unitPrice,
      quantity: itemReq.quantity,
      image: menuItem.imageUrl,
      selectedOptions: itemReq.selectedOptions || [],
      itemTotal,
    });
  }

  // Discount logic — V1 keeps it at 0 (per Phase 7 mock-data note).
  // The schema column exists so M2 can add a discount engine without a migration.
  const discount = 0;
  const totalAmount = subtotal - discount + PLATFORM_FEE;

  const newOrder = {
    orderNumber: generateOrderNumber(),
    studentId,
    outletId,
    outletSnapshot: JSON.stringify({ id: outlet.id, name: outlet.name }),
    status: ORDER_STATUS.PENDING,
    subtotal,
    discount,
    platformFee: PLATFORM_FEE,
    totalAmount,
    notes: notes || '',
    pickupCode: generatePickupCode(),
    scheduledFor,
    paymentMethod,
    paymentStatus: 'PENDING', // PAID will be set by webhook after Razorpay confirms
    items: processedItems,
  };

  return ordersRepo.createOrder(newOrder);
}

async function getUserOrders(studentId, { page, pageSize, status } = {}) {
  return ordersRepo.findByUserId(studentId, { page, pageSize, status });
}

async function getOrderById(studentId, orderId) {
  const order = await ordersRepo.findById(orderId);
  if (!order) throw { statusCode: 404, message: 'Order not found' };

  if (order.studentId !== studentId) {
    throw { statusCode: 403, message: 'You are not authorized to view this order' };
  }
  return order;
}

async function getOutletOrders(outletId, { page, pageSize, status } = {}) {
  return ordersRepo.findByOutletId(outletId, { page, pageSize, status });
}

// INO-P1-32 fix: expose the existing ordersRepo.countByStatus via a
// dedicated KPI endpoint. Previously the outlet dashboard would fetch up
// to 200 orders via listOutletOrders({ pageSize: 200 }) and compute
// per-status counts in JS — accurate only if there were ≤ 200 active
// orders, and wasteful of bandwidth. This endpoint returns just the
// counts via a single DB-level groupBy query (see orders.repository.js
// countByStatus), so the frontend can render the KPIs without pulling
// any order rows.
async function getOutletKPIs(outletId) {
  return ordersRepo.countByStatus(outletId);
}

async function getOutletOrder(outletId, orderId) {
  const order = await ordersRepo.findById(orderId);
  if (!order) throw { statusCode: 404, message: 'Order not found' };
  if (order.outletId !== outletId) {
    throw { statusCode: 403, message: 'You are not authorized to view this order' };
  }
  return order;
}

// INO-AUDIT3-13: the old updateOrderStatus + cancelOrder functions were
// superseded by transition.service.js performTransition() in commit
// 1447845. They're deleted here so there's a single source of truth for
// order transitions. The controller now calls performTransition directly;
// these old functions were dead code that could mislead future developers
// into thinking they were the authoritative path.
//
// The orders.repository.js updateStatus() function is still used by the
// transition service (which calls prisma.order.updateMany directly inside
// the tx for the atomic claim — see transition.service.js for details).
// The repository function is kept for backward compat in case any future
// caller wants a non-transactional update.

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  getOutletOrders,
  getOutletKPIs,
  getOutletOrder,
  generateOrderNumber,
  generatePickupCode,
};
