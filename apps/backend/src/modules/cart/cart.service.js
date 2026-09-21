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
const { validateAndComputeOptionsDelta, normalizeSelectedOptions } = require('../menu/customization');
const { toPaise, fromPaise } = require('../../lib/money'); // INO-AUDIT4-D14: centralized
const { OUTLET_STATUS, ERROR_CODES } = require('../../lib/constants');
const prisma = require('../../lib/prisma');

// INO-AUDIT3-5 fix: compute the priceDelta for a cart item's selectedOptions
// using the menu item's customizationGroups + options (now included in
// CART_INCLUDE in cart.repository.js). Returns paise (integer).
function computeOptionsDeltaPaise(menuItem, selectedOptionsJson) {
  if (!menuItem?.customizationGroups || !selectedOptionsJson) return 0;
  let selected;
  try { selected = JSON.parse(selectedOptionsJson); } catch { return 0; }
  if (!Array.isArray(selected) || selected.length === 0) return 0;
  // Reuse the validation helper — it builds the lookup, sums paise.
  // Note: this assumes the cart item's selectedOptions were validated at
  // add time (cart.service.js addItem calls validateAndComputeOptionsDelta).
  // If the menu item's options changed after add-time, this recomputes
  // based on the CURRENT state (which is correct — the cart preview
  // should reflect what the user would actually pay today).
  return validateAndComputeOptionsDelta(menuItem, selected);
}

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
  // INO-AUDIT3-6: pass normalized options to cartRepo.addItem so the
  // dedup/sort happens before the JSON comparison (same logical set
  // produces the same stored string).
  const normalizedOptions = normalizeSelectedOptions(selectedOptions);
  validateAndComputeOptionsDelta(menuItem, normalizedOptions);

  const item = await cartRepo.addItem(cart.id, menuItemId, quantity, normalizedOptions);
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
 *
 * INO-AUDIT3-5 fix: previously this computed `Number(menuItem.price) *
 * quantity` — ignoring customization priceDeltas. So the cart preview
 * showed ₹100 for "burger + extra cheese" while the actual order charge
 * was ₹130. Now we include the customization priceDelta by re-running
 * the validation helper against the cart item's selectedOptions (parsed
 * from the stored JSON string).
 *
 * INO-AUDIT3-4 fix: all arithmetic is integer paise — no floating-point
 * drift between cart preview and checkout.
 */
function computeTotals(cart) {
  if (!cart || !cart.items) return { subtotal: '0.00', platformFee: '0.00', total: '0.00', itemCount: 0 };

  let subtotalPaise = 0;
  let itemCount = 0;
  for (const i of cart.items) {
    const basePricePaise = toPaise(i.menuItem.price);
    const optionsDeltaPaise = computeOptionsDeltaPaise(i.menuItem, i.selectedOptions);
    const unitPricePaise = basePricePaise + optionsDeltaPaise;
    subtotalPaise += unitPricePaise * i.quantity;
    itemCount += i.quantity;
  }

  const platformFeePaise = subtotalPaise > 0 ? 500 : 0; // ₹5 in paise
  const totalPaise = subtotalPaise + platformFeePaise;

  return {
    subtotal: fromPaise(subtotalPaise),
    platformFee: fromPaise(platformFeePaise),
    total: fromPaise(totalPaise),
    itemCount,
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
