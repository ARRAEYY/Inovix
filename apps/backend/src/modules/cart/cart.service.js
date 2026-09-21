/**
 * Cart service — server-side cart operations.
 *
 * - One cart per student per outlet (V1: only one active cart per student)
 * - Items validate against current menu (must be available, must belong to outlet)
 * - Cart expires 24h after last update
 * - Checkout converts the cart to an Order (in orders.service.createOrder)
 */

const cartRepo = require('./cart.repository');
const menuRepo = require('../menu/menu.repository');
const { validateAndComputeOptionsDelta } = require('../menu/customization');
const { OUTLET_STATUS, ERROR_CODES } = require('../../lib/constants');
const prisma = require('../../lib/prisma');

// INO-P0-15: outlets in any of these statuses cannot accept new cart
// activity. The previous `getCart` only checked `if (!outlet)` — CLOSED,
// SUSPENDED, and PENDING outlets still let students build carts, which
// the order layer later rejected (creating a confusing UX) or — for
// SUSPENDED/PENDING — silently allowed cart operations on outlets that
// shouldn't be orderable at all.
const NON_ORDERABLE_OUTLET_STATUSES = new Set([
  OUTLET_STATUS.CLOSED,
  OUTLET_STATUS.SUSPENDED,
  OUTLET_STATUS.PENDING,
]);

async function getCart(studentId, outletId) {
  if (!outletId) throw { statusCode: 400, message: 'outletId is required' };
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw { statusCode: 404, message: 'Outlet not found' };
  if (NON_ORDERABLE_OUTLET_STATUSES.has(outlet.status)) {
    throw {
      statusCode: 400,
      code: ERROR_CODES.OUTLET_CLOSED,
      message: `Outlet is ${outlet.status} and not accepting orders right now`,
    };
  }
  return cartRepo.findOrCreateCart(studentId, outletId);
}

async function getActiveCart(studentId) {
  return cartRepo.findByStudent(studentId);
}

async function addItem(studentId, outletId, { menuItemId, quantity, selectedOptions }) {
  const cart = await getCart(studentId, outletId);
  const menuItem = await menuRepo.findById(menuItemId);
  if (!menuItem) throw { statusCode: 404, message: 'Menu item not found' };
  if (menuItem.outletId !== outletId) {
    throw { statusCode: 400, message: 'Menu item does not belong to this outlet' };
  }
  if (!menuItem.isAvailable) {
    throw { statusCode: 400, message: `${menuItem.name} is currently unavailable` };
  }
  // INO-P0-14 fix: validate selectedOptions at cart-add time too (not just
  // at order creation). Without this, a student could add a cart item with
  // a non-existent optionId or an option from a different menu item, and
  // the bad data would only fail at checkout. Now we reject early.
  // The returned priceDelta is discarded here — the cart preview uses the
  // base menu price (see `computeTotals`); the order-time computation is
  // the source of truth for the actual charge.
  validateAndComputeOptionsDelta(menuItem, selectedOptions);

  const item = await cartRepo.addItem(cart.id, menuItemId, quantity, selectedOptions);
  // Refresh cart expiry
  await prisma.cart.update({
    where: { id: cart.id },
    data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  return cartRepo.findOrCreateCart(studentId, outletId);
}

async function updateItem(studentId, cartItemId, quantity) {
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: { cart: true },
  });
  if (!cartItem) throw { statusCode: 404, message: 'Cart item not found' };
  if (cartItem.cart.studentId !== studentId) {
    throw { statusCode: 403, message: 'Not your cart' };
  }
  await cartRepo.updateItemQuantity(cartItemId, quantity);
  return cartRepo.findByStudent(studentId);
}

async function removeItem(studentId, cartItemId) {
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: { cart: true },
  });
  if (!cartItem) throw { statusCode: 404, message: 'Cart item not found' };
  if (cartItem.cart.studentId !== studentId) {
    throw { statusCode: 403, message: 'Not your cart' };
  }
  await cartRepo.removeItem(cartItemId);
  return cartRepo.findByStudent(studentId);
}

async function clearCart(studentId) {
  const cart = await cartRepo.findByStudent(studentId);
  if (!cart) return null;
  await cartRepo.clearCart(cart.id);
  return null;
}

/**
 * Compute cart totals — subtotal, platform fee, total.
 * Used by checkout endpoint to preview the order before payment.
 */
function computeTotals(cart) {
  if (!cart || !cart.items) return { subtotal: 0, platformFee: 0, total: 0, itemCount: 0 };
  const subtotal = cart.items.reduce((sum, i) => sum + Number(i.menuItem.price) * i.quantity, 0);
  const platformFee = subtotal > 0 ? 5 : 0;
  return {
    subtotal,
    platformFee,
    total: subtotal + platformFee,
    itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

module.exports = {
  getCart,
  getActiveCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  computeTotals,
};
