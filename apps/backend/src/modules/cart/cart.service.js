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
const prisma = require('../../lib/prisma');

async function getCart(studentId, outletId) {
  if (!outletId) throw { statusCode: 400, message: 'outletId is required' };
  // Verify outlet exists + is open
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw { statusCode: 404, message: 'Outlet not found' };

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
